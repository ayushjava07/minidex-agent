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

// ── Topic handlers, isolated per node ──────────────────
const topicHandlers = new WeakMap()

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
            for await (const chunk of stream) {
                chunks.push(chunk instanceof Uint8ArrayList ? chunk.subarray() : chunk)
            }
            const raw     = chunks.map(c => toString(c)).join('')
            const message = JSON.parse(raw)

            console.log(`[Network][${role}] ← [${message.topic}] from [${message.from}]`)

            const handlers = topicHandlers.get(node)?.get(message.topic)
            if (handlers) {
                for (const h of handlers) {
                    try { await h(message.data) } catch (e) {
                        console.error(`[Network] Handler error: ${e.message}`)
                    }
                }
            }

            await stream.close()

        } catch (err) {
            console.error(`[Network][${role}] Handler error: ${err.message}`)
        }
    })

    // ── Connection events ─────────────────────────────
    node.addEventListener('peer:connect', () => {
        console.log(`[Network][${role}] ✅ Peers: ${getUniquePeerCount(node)}`)
    })

    node.addEventListener('peer:disconnect', () => {
        const cnt = getUniquePeerCount(node)
        if (cnt === 0) return
        console.log(`[Network][${role}] ❌ Peers: ${cnt}`)
    })

    await node.start()

    // ── Register self in shared registry ─────────────
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
            // Step 1: Register address in peerStore.
            // libp2p needs PeerID and multiaddr before dialing by PeerId.
            await node.peerStore.merge(info.peerId, {
                multiaddrs: [multiaddr(`/ip4/127.0.0.1/tcp/${info.port}`)]
            })

            await node.dial(info.peerId)

            console.log(`[Network][${myRole}] ✅ [${role}] at port ${info.port}`)
            connected++
        } catch (err) {
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
            stream.sendData(new Uint8ArrayList(fromString(payload)))
            await stream.close()
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
    if (!topicHandlers.has(node)) {
        topicHandlers.set(node, new Map())
    }
    const nodeHandlers = topicHandlers.get(node)
    if (!nodeHandlers.has(topic)) {
        nodeHandlers.set(topic, [])
    }
    nodeHandlers.get(topic).push(handler)
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
