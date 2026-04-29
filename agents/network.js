// agents/network.js
import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { noise } from '@chainsafe/libp2p-noise'
import { mplex } from '@libp2p/mplex'
import { mdns } from '@libp2p/mdns'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'

export async function createAgentNode(role) {
    const node = await createLibp2p({
        transports: [tcp()],
        connectionEncryption: [noise()],
        streamMuxers: [mplex()],
        
        // Peer Discovery - No central registry!
        peerDiscovery: [
            mdns({
                interval: 5000
            })
        ],
        
        services: {
            pubsub: gossipsub()
        }
    })

    await node.start()

    console.log(`\n🤖 Agent [${role}] Started`)
    console.log(`📍 Peer ID: ${node.peerId.toString()}`)
    console.log(`📡 Listening on:`)
    node.getMultiaddrs().forEach(addr => {
        console.log(`   ${addr.toString()}`)
    })

    // Auto peer discovery
    node.addEventListener('peer:discovery', (event) => {
        console.log(`🔍 [${role}] Found peer:`, 
            event.detail.id.toString())
    })

    // Peer connected
    node.addEventListener('peer:connect', (event) => {
        console.log(`✅ [${role}] Connected to:`, 
            event.detail.toString())
    })

    return node
}

export async function publishMessage(node, topic, message) {
    const data = new TextEncoder().encode(JSON.stringify(message))
    await node.services.pubsub.publish(topic, data)
    console.log(`📤 Published to ${topic}:`, message)
}

export async function subscribeToTopic(node, topic, handler) {
    node.services.pubsub.subscribe(topic)
    node.services.pubsub.addEventListener('message', (event) => {
        if (event.detail.topic === topic) {
            const data = JSON.parse(
                new TextDecoder().decode(event.detail.data)
            )
            handler(data)
        }
    })
    console.log(`👂 Subscribed to topic: ${topic}`)
}
