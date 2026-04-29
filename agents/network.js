import net from 'net'
import fs from 'fs'
import path from 'path'
import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { noise } from '@chainsafe/libp2p-noise'
import { mplex } from '@libp2p/mplex'
import { identify } from '@libp2p/identify'

const topicHandlers = new Map()

const AGENT_PORTS = {
    'deploy':  { libp2p: 4001, msg: 5001 },
    'monitor': { libp2p: 4002, msg: 5002 },
    'report':  { libp2p: 4003, msg: 5003 }
}

const PEERS_FILE = path.join(process.cwd(), 'agents', 'peers.json')

function savePeer(role, libp2pAddr, msgPort) {
    let peers = {}
    if (fs.existsSync(PEERS_FILE)) {
        peers = JSON.parse(fs.readFileSync(PEERS_FILE, 'utf8'))
    }
    peers[role] = { libp2pAddr, msgPort }
    fs.writeFileSync(PEERS_FILE, JSON.stringify(peers, null, 2))
    console.log(`[Network] Saved address for [${role}]`)
}

function startMessageServer(role, msgPort) {
    const server = net.createServer((socket) => {
        let buffer = ''
        socket.on('data', (data) => {
            buffer += data.toString()
            const lines = buffer.split('\n')
            buffer = lines.pop()
            lines.forEach(line => {
                if (!line.trim()) return
                try {
                    const { topic, data: msgData } = JSON.parse(line)
                    console.log(`[Network] Received on [${topic}]`)
                    const handlers = topicHandlers.get(topic)
                    if (handlers) {
                        handlers.forEach(h => h(msgData))
                    }
                } catch(e) {}
            })
        })
        socket.on('error', () => {})
    })

    server.listen(msgPort, '127.0.0.1', () => {
        console.log(`[Network] Message server on port ${msgPort}`)
    })

    return server
}

function sendToPort(msgPort, payload) {
    return new Promise((resolve) => {
        const client = new net.Socket()
        let done = false

        client.connect(msgPort, '127.0.0.1', () => {
            client.write(JSON.stringify(payload) + '\n')
            client.destroy()
            if (!done) { done = true; resolve(true) }
        })

        client.on('error', () => {
            if (!done) { done = true; resolve(false) }
        })

        client.setTimeout(3000, () => {
            client.destroy()
            if (!done) { done = true; resolve(false) }
        })
    })
}

export async function createAgentNode(role) {
    const ports = AGENT_PORTS[role]
    if (!ports) throw new Error(`Unknown role: ${role}`)

    // libp2p node - peer identity ke liye
    const node = await createLibp2p({
        addresses: {
            listen: [`/ip4/127.0.0.1/tcp/${ports.libp2p}`]
        },
        transports: [tcp()],
        connectionEncryption: [noise()],
        streamMuxers: [mplex()],
        services: { identify: identify() }
    })

    await node.start()
    node.role = role

    const libp2pAddr = `/ip4/127.0.0.1/tcp/${ports.libp2p}/p2p/${node.peerId.toString()}`
    
    // Message server start karo
    startMessageServer(role, ports.msg)
    
    // Address save karo
    savePeer(role, libp2pAddr, ports.msg)

    console.log(`[Network] Agent [${role}] started`)
    console.log(`[Network] Peer ID: ${node.peerId.toString()}`)
    console.log(`[Network] libp2p: ${libp2pAddr}`)
    console.log(`[Network] Messaging port: ${ports.msg}`)

    return node
}

export async function publishMessage(node, topic, message) {
    if (!fs.existsSync(PEERS_FILE)) return

    let peers = {}
    try {
        peers = JSON.parse(fs.readFileSync(PEERS_FILE, 'utf8'))
    } catch(e) { return }

    let sent = 0
    for (const [role, info] of Object.entries(peers)) {
        if (role === node.role) continue

        const ok = await sendToPort(info.msgPort, { topic, data: message })
        if (ok) {
            sent++
            console.log(`[Network] Sent [${topic}] to [${role}]`)
        }
    }

    if (sent === 0) {
        console.log(`[Network] No peers available for [${topic}]`)
    }
}

export function subscribeToTopic(node, topic, handler) {
    if (!topicHandlers.has(topic)) {
        topicHandlers.set(topic, [])
    }
    topicHandlers.get(topic).push(handler)
    console.log(`[Network] Subscribed to: ${topic}`)
}