// Minimal test to verify libp2p v3 dialing works
import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { identify } from '@libp2p/identify'
import { multiaddr } from '@multiformats/multiaddr'

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function test() {
    console.log('Creating node A on port 5001...')
    const nodeA = await createLibp2p({
        addresses: { listen: ['/ip4/127.0.0.1/tcp/5001'] },
        transports: [tcp()],
        connectionEncryption: [noise()],
        streamMuxers: [yamux()],
        services: { identify: identify() }
    })
    await nodeA.start()
    console.log(`NodeA started. PeerID: ${nodeA.peerId.toString()}`)
    console.log(`NodeA multiaddrs:`, nodeA.getMultiaddrs().map(m => m.toString()))

    console.log('\nCreating node B on port 5002...')
    const nodeB = await createLibp2p({
        addresses: { listen: ['/ip4/127.0.0.1/tcp/5002'] },
        transports: [tcp()],
        connectionEncryption: [noise()],
        streamMuxers: [yamux()],
        services: { identify: identify() }
    })
    await nodeB.start()
    console.log(`NodeB started. PeerID: ${nodeB.peerId.toString()}`)
    console.log(`NodeB multiaddrs:`, nodeB.getMultiaddrs().map(m => m.toString()))

    // Register a handler for test protocol on NodeB
    await nodeB.handle('/test/1.0.0', async ({ stream }) => {
        console.log('[NodeB] Received stream!')
        stream.closeRead()
        stream.closeWrite()
    })

    console.log('\nWaiting 2s for TCP to be ready...')
    await sleep(2000)

    console.log('\nAttempting: NodeA dial NodeB...')
    try {
        const addr = multiaddr(`/ip4/127.0.0.1/tcp/5002/p2p/${nodeB.peerId.toString()}`)
        console.log(`Dialing address: ${addr.toString()}`)
        
        const conn = await nodeA.dial(addr)
        console.log('✅ Dial succeeded!')
        console.log('Attempting to open stream...')
        
        const stream = await conn.newStream('/test/1.0.0')
        console.log('✅ Stream opened!')
        stream.closeRead()
        stream.closeWrite()
    } catch (err) {
        console.error('❌ Dial failed:', {
            name: err.name,
            message: err.message,
            code: err.code
        })
    }

    console.log('\nCleaning up...')
    await nodeA.stop()
    await nodeB.stop()
    console.log('Done!')
}

test().catch(err => {
    console.error('Test failed:', err)
    process.exit(1)
})
