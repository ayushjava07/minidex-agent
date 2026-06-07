// agents/network.js — v2.1.0

import { createLibp2p } from 'libp2p'
import { tcp }          from '@libp2p/tcp'
import { noise }        from '@chainsafe/libp2p-noise'
import { yamux }        from '@chainsafe/libp2p-yamux'
import { identify }     from '@libp2p/identify'
import { Uint8ArrayList } from 'uint8arraylist'
import { toString }     from 'uint8arrays/to-string'
import { fromString }   from 'uint8arrays/from-string'
import { multiaddr }    from '@multiformats/multiaddr'
import { createLogger } from './logger.js'
import { classifyMetricError, networkMetrics } from './metrics.js'
import { createRateLimiter, loadRateLimitConfig, messageRateLimitKey } from './rate-limit.js'
import { loadRetryConfig, withRetry } from './retry.js'
import {
    loadMessageValidationConfig,
    parseMessage
} from './message-schema.js'
import {
    createAuthenticatedEnvelope,
    createReplayProtector,
    loadMessageAuthConfig,
    verifyMessageAuthentication
} from './message-auth.js'

// ── Constants ──────────────────────────────────────────
const PROTOCOL    = '/atos/1.0.0'
const logger      = createLogger('network')
const retryConfig = loadRetryConfig()
const messageConfig = loadMessageValidationConfig()
const rateLimitConfig = loadRateLimitConfig()

const AGENT_PORTS = {
    deploy   : 4001,
    monitor  : 4002,
    report   : 4003,
    liquidity: 4004,
    analytics: 4005
}

// ── Shared registry — ALL agents in same process ───────
// Maps role → { peerId, port }
const agentRegistry = new Map()

// ── Topic handlers, isolated per node ──────────────────
const topicHandlers = new WeakMap()
const replayProtectors = new WeakMap()
const messageRateLimiters = new WeakMap()

// ── Helpers ────────────────────────────────────────────
function getUniquePeerCount(node) {
    const seen = new Set()
    return node.getConnections().filter(c => {
        const id = c.remotePeer.toString()
        if (seen.has(id)) return false
        seen.add(id)
        return true
    }).length
}

async function dialPeer(node, role, info) {
    return withRetry(async () => {
        await node.peerStore.merge(info.peerId, {
            multiaddrs: [multiaddr(`/ip4/127.0.0.1/tcp/${info.port}`)]
        })
        return node.dial(info.peerId)
    }, {
        ...retryConfig,
        onRetry: ({ attempt, delayMs, error }) => {
            logger.warn('peer_connection_retry', {
                role: node.role,
                peerRole: role,
                attempt,
                delayMs,
                error
            })
        }
    })
}

// ─────────────────────────────────────────────────────────
export async function createAgentNode(role) {
    const authConfig = loadMessageAuthConfig()
    const port = AGENT_PORTS[role]
    if (!port) throw new Error(`Unknown role: ${role}`)

    const node = await createLibp2p({
        addresses: {
            listen: [`/ip4/127.0.0.1/tcp/${port}`]
        },
        transports:           [tcp()],
        connectionEncrypters: [noise()],
        streamMuxers:         [yamux()],
        services: {
            identify: identify()
        }
    })

    // ── Handle incoming ATOS messages ─────────────────
    await node.handle(PROTOCOL, async (stream) => {
        try {
            const chunks = []
            let receivedBytes = 0
            for await (const chunk of stream) {
                const bytes = chunk instanceof Uint8ArrayList ? chunk.subarray() : chunk
                receivedBytes += bytes.byteLength
                if (receivedBytes > messageConfig.maxMessageBytes) {
                    throw new Error(`Message exceeds maximum size of ${messageConfig.maxMessageBytes} bytes`)
                }
                chunks.push(bytes)
            }
            const raw     = chunks.map(c => toString(c)).join('')
            const message = parseMessage(raw, messageConfig)
            verifyMessageAuthentication(message, authConfig.secret)
            replayProtectors.get(node).assertFresh(message)
            try {
                messageRateLimiters.get(node).consume(messageRateLimitKey(message))
            } catch (error) {
                if (error.code === 'RATE_LIMITED') {
                    networkMetrics.messagesRateLimited.inc({
                        role,
                        sender: message.from,
                        topic: message.topic
                    })
                }
                throw error
            }

            networkMetrics.messageBytes.observe({ direction: 'inbound', role }, receivedBytes)
            networkMetrics.messagesReceived.inc({ role, topic: message.topic })
            logger.info('message_received', { role, topic: message.topic, from: message.from })

            const handlers = topicHandlers.get(node)?.get(message.topic)
            if (handlers) {
                for (const h of handlers) {
                    try { await h(message.data) } catch (e) {
                        logger.error('topic_handler_failed', { role, topic: message.topic, error: e })
                    }
                }
            }
        } catch (err) {
            networkMetrics.messageFailures.inc({
                direction: 'inbound',
                reason: classifyMetricError(err),
                role
            })
            logger.error('message_handler_failed', { role, error: err })
        } finally {
            await stream.close().catch(error => {
                logger.warn('message_stream_close_failed', { role, error })
            })
        }
    })

    // ── Connection events ─────────────────────────────
    node.addEventListener('peer:connect', () => {
        const peers = getUniquePeerCount(node)
        networkMetrics.connectedPeers.set({ role }, peers)
        logger.info('peer_connected', { role, peers })
    })

    node.addEventListener('peer:disconnect', () => {
        const cnt = getUniquePeerCount(node)
        networkMetrics.connectedPeers.set({ role }, cnt)
        if (cnt === 0) return
        logger.warn('peer_disconnected', { role, peers: cnt })
    })

    await node.start()

    // ── Register self in shared registry ─────────────
    agentRegistry.set(role, {
        peerId : node.peerId,
        port   : port
    })

    node.role = role
    replayProtectors.set(node, createReplayProtector(authConfig))
    messageRateLimiters.set(node, createRateLimiter(rateLimitConfig))
    networkMetrics.connectedPeers.set({ role }, 0)

    logger.info('agent_started', {
        role,
        peerId: node.peerId.toString(),
        address: `/ip4/127.0.0.1/tcp/${port}`,
        protocol: PROTOCOL
    })

    return node
}

// ─────────────────────────────────────────────────────────
// Call AFTER all agents created — uses registry for full multiaddr
// ─────────────────────────────────────────────────────────
export async function connectToAllPeers(node) {
    const myRole = node.role
    const myPort = AGENT_PORTS[myRole]

    logger.info('peer_connection_started', { role: myRole })

    let connected = 0

    for (const [role, info] of agentRegistry.entries()) {
        // Skip self
        if (info.port === myPort) continue

        try {
            // Step 1: Register address in peerStore.
            // libp2p needs PeerID and multiaddr before dialing by PeerId.
            await dialPeer(node, role, info)

            logger.info('peer_connection_succeeded', { role: myRole, peerRole: role, port: info.port })
            connected++
        } catch (err) {
            logger.warn('peer_connection_failed', { role: myRole, peerRole: role, port: info.port, error: err })
        }
    }

    logger.info('peer_connection_completed', {
        role: myRole,
        connected,
        expected: Object.keys(AGENT_PORTS).length - 1
    })
    return connected
}

// ─────────────────────────────────────────────────────────
export async function publishMessage(node, topic, data) {
    const authConfig = loadMessageAuthConfig()
    // Get existing connections
    let seen = new Set()
    let unique = node.getConnections().filter(c => {
        const id = c.remotePeer.toString()
        if (seen.has(id)) return false
        seen.add(id)
        return true
    })

    // Try to establish missing connections
    for (const [role, info] of agentRegistry.entries()) {
        if (node.role === role) continue // Skip self
        
        // Check if we're already connected to this peer
        const alreadyConnected = unique.some(c => c.remotePeer.equals(info.peerId))
        if (alreadyConnected) continue
        
        try {
            // Attempt to dial
            const conn = await dialPeer(node, role, info)
            unique.push(conn)
        } catch (err) {
            logger.warn('peer_reconnect_failed', { role: node.role, peerRole: role, error: err })
        }
    }

    if (unique.length === 0) {
        logger.warn('broadcast_no_peers', { role: node.role, topic })
        return { sent: 0, total: 0 }
    }

    const payload = JSON.stringify(createAuthenticatedEnvelope(topic, data, node.role, {
        config: authConfig
    }))
    const payloadBytes = Buffer.byteLength(payload, 'utf8')

    let sent = 0

    for (const conn of unique) {
        try {
            const stream = await conn.newStream(PROTOCOL)
            stream.sendData(new Uint8ArrayList(fromString(payload)))
            await stream.close()
            sent++
            networkMetrics.messageBytes.observe({ direction: 'outbound', role: node.role }, payloadBytes)
            networkMetrics.messagesSent.inc({ role: node.role, topic })
            logger.debug('message_sent', {
                role: node.role,
                topic,
                peerId: conn.remotePeer.toString()
            })
        } catch (err) {
            networkMetrics.messageFailures.inc({
                direction: 'outbound',
                reason: classifyMetricError(err),
                role: node.role
            })
            logger.warn('message_send_failed', {
                role: node.role,
                topic,
                peerId: conn.remotePeer.toString(),
                error: err
            })
        }
    }

    logger.info('broadcast_completed', { role: node.role, topic, sent, total: unique.length })
    return { sent, total: unique.length }
}

// ─────────────────────────────────────────────────────────
export function subscribeToTopic(node, topic, handler) {
    if (!topicHandlers.has(node)) {
        topicHandlers.set(node, new Map())
    }
    const nodeHandlers = topicHandlers.get(node)
    if (!nodeHandlers.has(topic)) {
        nodeHandlers.set(topic, [])
    }
    nodeHandlers.get(topic).push(handler)
    logger.info('topic_subscribed', { role: node.role, topic })
}

// ─────────────────────────────────────────────────────────
export function getNetworkStatus(node) {
    const seen  = new Set()
    const peers = node.getConnections()
        .filter(c => {
            const id = c.remotePeer.toString()
            if (seen.has(id)) return false
            seen.add(id)
            return true
        })
        .map(c => c.remotePeer.toString().slice(0, 16) + '...')

    return { role: node.role, peers: peers.length, list: peers }
}

// ─────────────────────────────────────────────────────────
export { agentRegistry }
