// agents/network.js — FINAL WORKING VERSION

import { createLibp2p } from 'libp2p'
import { tcp }          from '@libp2p/tcp'
import { noise }        from '@chainsafe/libp2p-noise'
import { yamux }        from '@chainsafe/libp2p-yamux'
import { identify }     from '@libp2p/identify'
import { pipe }         from 'it-pipe'
import { toString }     from 'uint8arrays/to-string'
import { fromString }   from 'uint8arrays/from-string'
import { multiaddr }    from '@multiformats/multiaddr'

// ── Constants ──────────────────────────────────────────
const PROTOCOL    = '/atos/1.0.0'

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

// ── Topic handlers ─────────────────────────────────────
const topicHandlers = new Map()

// ── Helpers ────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms))

function getUniquePeerCount(node) {
    const seen = new Set()
    return node.getConnections().filter(c => {
        const id = c.remotePeer.toString()
        if (seen.has(id)) return false
        seen.add(id)
        return true
    }).length
}

// ─────────────────────────────────────────────────────────
export async function createAgentNode(role) {
    const port = AGENT_PORTS[role]
    if (!port) throw new Error(`Unknown role: ${role}`)

    const node = await createLibp2p({
        addresses: {
            listen: [`/ip4/127.0.0.1/tcp/${port}`]
        },
        transports:           [tcp()],
        connectionEncryption: [noise()],
        streamMuxers:         [yamux()],
        services: {
            identify: identify()
        }
    })

    // ── Handle incoming ATOS messages ─────────────────
    await node.handle(PROTOCOL, async ({ stream, connection }) => {
        try {
            console.log(`[Network][${role}] RECEIVED STREAM from ${connection.remotePeer.toString().slice(0, 16)}...`)
            const chunks = []
            for await (const chunk of stream.source) {
                chunks.push(chunk)
            }
            const raw     = chunks.map(c => toString(c)).join('')
            const message = JSON.parse(raw)

            console.log(`[Network][${role}] ← [${message.topic}] from [${message.from}]`)

            const handlers = topicHandlers.get(message.topic)
            if (handlers) {
                for (const h of handlers) h(message.data)
            }

            // Close both read and write sides of stream
            stream.closeRead()
            stream.closeWrite()

        } catch (err) {
            console.error(`[Network][${role}] Handler error: ${err.message}`)
        }
    })

    // ── Connection events ─────────────────────────────
    node.addEventListener('peer:connect', () => {
        console.log(`[Network][${role}] ✅ Peers: ${getUniquePeerCount(node)}`)
    })

    node.addEventListener('peer:disconnect', () => {
        console.log(`[Network][${role}] ❌ Peers: ${getUniquePeerCount(node)}`)
    })

    await node.start()

    // ── Register self in shared registry ─────────────
    // This is the KEY — store peerId so others can dial
    agentRegistry.set(role, {
        peerId : node.peerId,
        port   : port
    })

    node.role = role

    console.log(`\n${'═'.repeat(52)}`)
    console.log(` Agent    : ${role}`)
    console.log(` PeerID   : ${node.peerId.toString()}`)
    console.log(` Address  : /ip4/127.0.0.1/tcp/${port}`)
    console.log(` Protocol : ${PROTOCOL}`)
    console.log(`${'═'.repeat(52)}\n`)

    return node
}

// ─────────────────────────────────────────────────────────
// Call AFTER all agents created — uses registry for full multiaddr
// ─────────────────────────────────────────────────────────
export async function connectToAllPeers(node) {
    const myRole = node.role
    const myPort = AGENT_PORTS[myRole]

    console.log(`[Network][${myRole}] Connecting to all peers...`)

    let connected = 0

    for (const [role, info] of agentRegistry.entries()) {
        // Skip self
        if (info.port === myPort) continue

        try {
            // Step 1: Register address AND advertise protocols in peer Store
            const targetAddr = multiaddr(`/ip4/127.0.0.1/tcp/${info.port}`)
            await node.peerStore.merge(info.peerId, {
                multiaddrs: [targetAddr],
                protocols: [PROTOCOL]  // Also advertise protocol support
            })

            console.log(`[Network][${myRole}] DEBUG: Attempting dial to [${role}] at ${info.port}...`)

            // Step 2: Establish connection 
            const conn = await node.dial(info.peerId)
            
            // Step 3: Verify connection by opening a test stream
            const testStream = await conn.newStream(PROTOCOL)
            testStream.closeRead()
            testStream.closeWrite()
            
            console.log(`[Network][${myRole}] ✅ [${role}] at port ${info.port}`)
            connected++
        } catch (err) {
            console.error(`[Network][${myRole}] FULL ERROR:`, {
                code: err.code,
                name: err.name,
                message: err.message,
                stack: err.stack?.split('\n').slice(0, 3).join('\n')
            })
            console.log(`[Network][${myRole}] ⚠️  [${role}]: ${err.message.slice(0, 60)}`)
        }
    }

    console.log(`[Network][${myRole}] Connected: ${connected}/${Object.keys(AGENT_PORTS).length - 1}\n`)
    return connected
}

// ─────────────────────────────────────────────────────────
export async function publishMessage(node, topic, data) {
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
            const targetAddr = multiaddr(`/ip4/127.0.0.1/tcp/${info.port}`)
            await node.peerStore.merge(info.peerId, { multiaddrs: [targetAddr] })
            const conn = await node.dial(info.peerId)
            
            // Verify connection works
            const testStream = await conn.newStream(PROTOCOL)
            testStream.closeRead()
            testStream.closeWrite()
            
            unique.push(conn)
        } catch (err) {
            // Connection failed, skip this peer
        }
    }

    if (unique.length === 0) {
        console.log(`[Network][${node.role}] ⚠️  No peers for [${topic}]`)
        return { sent: 0, total: 0 }
    }

    const payload = JSON.stringify({
        topic,
        data,
        from : node.role,
        ts   : Date.now()
    })

    let sent = 0

    for (const conn of unique) {
        try {
            const stream = await conn.newStream(PROTOCOL)
            await pipe([fromString(payload)], stream.sink)
            // Close both read and write sides of stream
            stream.closeRead()
            stream.closeWrite()
            sent++
            console.log(`[Network][${node.role}] → [${topic}] → ${conn.remotePeer.toString().slice(0, 16)}...`)
        } catch (err) {
            console.log(`[Network][${node.role}] Send error: ${err.message.slice(0, 50)}`)
        }
    }

    console.log(`[Network][${node.role}] Broadcast [${topic}]: ${sent}/${unique.length}`)
    return { sent, total: unique.length }
}

// ─────────────────────────────────────────────────────────
export function subscribeToTopic(node, topic, handler) {
    if (!topicHandlers.has(topic)) {
        topicHandlers.set(topic, [])
    }
    topicHandlers.get(topic).push(handler)
    console.log(`[Network][${node.role}] Subscribed: ${topic}`)
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