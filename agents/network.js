import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { noise } from '@chainsafe/libp2p-noise'
import { mplex } from '@libp2p/mplex'
import { mdns } from '@libp2p/mdns'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { identify } from '@libp2p/identify'

export async function createAgentNode(role) {
    const ports = {
        'deploy':  4001,
        'monitor': 4002,
        'report':  4003
    }

    const port = ports[role] || 4000

    const node = await createLibp2p({
        addresses: {
            listen: [`/ip4/0.0.0.0/tcp/${port}`]
        },
        transports: [tcp()],
        connectionEncryption: [noise()],
        streamMuxers: [mplex()],
        peerDiscovery: [
            mdns({ interval: 5000 })
        ],
        services: {
            identify: identify(),
            pubsub: gossipsub({
                allowPublishToZeroTopicPeers: true
            })
        }
    })

    await node.start()

    console.log(`Agent [${role}] Started`)
    console.log(`Peer ID: ${node.peerId.toString()}`)
    console.log(`Listening on:`)
    node.getMultiaddrs().forEach(addr => {
        console.log(`   ${addr.toString()}`)
    })

    node.addEventListener('peer:discovery', (event) => {
        console.log(`[${role}] Found peer:`, 
            event.detail.id.toString().slice(0, 20) + '...')
    })

    node.addEventListener('peer:connect', (event) => {
        console.log(`[${role}] Peer connected!`)
    })

    return node
}

export async function publishMessage(node, topic, message) {
    try {
        const data = new TextEncoder().encode(JSON.stringify(message))
        await node.services.pubsub.publish(topic, data)
        console.log(`Published to [${topic}]`)
    } catch (err) {
        console.log(`Publish failed: ${err.message}`)
    }
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
    console.log(`Subscribed to: ${topic}`)
}