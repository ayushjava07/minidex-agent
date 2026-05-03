// agents/network.js — NEW VERSION
// Drops peers.json — uses mDNS for real discovery

import { createLibp2p }  from 'libp2p'
import { tcp }           from '@libp2p/tcp'
import { noise }         from '@chainsafe/libp2p-noise'
import { yamux }         from '@chainsafe/libp2p-yamux'
import { identify }      from '@libp2p/identify'
import { mdns }          from '@libp2p/mdns'
import { pipe }          from 'it-pipe'
import { toString }      from 'uint8arrays/to-string'
import { fromString }    from 'uint8arrays/from-string'

// ── Constants ────────────────────────────────────────
const PROTOCOL        = '/atos/1.0.0'
const AGENT_PORTS     = {
    deploy:  4001,
    monitor: 4002,
    report:  4003
}

// ── Topic handlers — same API as before ──────────────
const topicHandlers = new Map()

// ── Single exported node reference ───────────────────
let globalNode = null

// ─────────────────────────────────────────────────────
export async function createAgentNode(role) {
    const port = AGENT_PORTS[role]
    if (!port) throw new Error(`Unknown role: ${role}`)

    const node = await createLibp2p({
        addresses: {
            listen: [`/ip4/0.0.0.0/tcp/${port}`]
        },
        transports:           [tcp()],
        connectionEncryption: [noise()],
        streamMuxers:         [yamux()],
        services: {
            identify: identify()
        },
        peerDiscovery: [
            // mDNS — automatically finds agents on same machine/LAN
            // No configuration needed — just works
            mdns({
                interval:   10_000,
                serviceTag: 'atos-agent'   // all ATOS agents share this tag
            })
        ]
    })

    // ── Handle incoming ATOS protocol messages ────────
    await node.handle(PROTOCOL, async ({ stream, connection }) => {
        try {
            const chunks = []
            for await (const chunk of stream.source) {
                chunks.push(chunk)
            }
            const raw     = chunks.map(c => toString(c)).join('')
            const message = JSON.parse(raw)

            console.log(`[Network] Received [${message.topic}] from [${message.from}]`)

            const handlers = topicHandlers.get(message.topic)
            if (handlers) {
                handlers.forEach(h => h(message.data))
            }
        } catch (err) {
            console.error(`[Network] Message parse error: ${err.message}`)
        }
    })

    // ── Auto connect when peer discovered via mDNS ───
    node.addEventListener('peer:discovery', async (evt) => {
        const peerId = evt.detail.id.toString()
        console.log(`[mDNS] Discovered peer: ${peerId.slice(0, 20)}...`)

        try {
            await node.dial(evt.detail.id)
            console.log(`[mDNS] Connected to: ${peerId.slice(0, 20)}...`)
        } catch {
            // peer may not be ready yet — okay
        }
    })

    node.addEventListener('peer:connect', (evt) => {
        console.log(`[Network] Peer connected: ${evt.detail.toString().slice(0, 20)}...`)
    })

    node.addEventListener('peer:disconnect', (evt) => {
        console.log(`[Network] Peer disconnected: ${evt.detail.toString().slice(0, 20)}...`)
    })

    await node.start()

    node.role = role
    globalNode = node

    console.log(`[Network] Agent [${role}] started`)
    console.log(`[Network] Peer ID : ${node.peerId.toString()}`)
    console.log(`[Network] Addr    : /ip4/0.0.0.0/tcp/${port}/p2p/${node.peerId}`)
    console.log(`[Network] Discovery: mDNS active — waiting for peers...`)

    return node
}

// ─────────────────────────────────────────────────────
export async function publishMessage(node, topic, message) {
    const connections = node.getConnections()

    if (connections.length === 0) {
        console.log(`[Network] No peers connected yet for [${topic}]`)
        return
    }

    let sent = 0

    for (const conn of connections) {
        try {
            const stream  = await conn.newStream(PROTOCOL)
            const payload = JSON.stringify({
                topic,
                data: message,
                from: node.role,
                ts:   Date.now()
            })

            await pipe(
                [fromString(payload)],
                stream
            )

            sent++
            console.log(`[Network] Sent [${topic}] to ${conn.remotePeer.toString().slice(0, 20)}...`)
        } catch {
            // connection may have dropped
        }
    }

    if (sent === 0) {
        console.log(`[Network] No peers available for [${topic}]`)
    }
}

// ─────────────────────────────────────────────────────
export function subscribeToTopic(node, topic, handler) {
    if (!topicHandlers.has(topic)) {
        topicHandlers.set(topic, [])
    }
    topicHandlers.get(topic).push(handler)
    console.log(`[Network] Subscribed to: ${topic}`)
}