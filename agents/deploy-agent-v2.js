import { createAgentNode, publishMessage } from './network.js'
import { generateCID } from './cid-helper.js'
import { generateKeys, encryptMessage } from './pqc.js'

async function main() {
    console.log("===================================")
    console.log("   Deploy Agent v2 Started")
    console.log("   Using libp2p peer discovery")
    console.log("===================================")

    const node = await createAgentNode('deploy')

    // Subscribe first
    node.services.pubsub.subscribe('agent-tasks')
    node.services.pubsub.subscribe('heartbeat')

    // Wait for peers
    console.log('Waiting for peers (10 sec)...')
    await new Promise(resolve => setTimeout(resolve, 10000))

    const state = {
        agent: 'deploy-1',
        peerId: node.peerId.toString(),
        workflow: 'deploy',
        status: 'completed',
        timestamp: Date.now()
    }

    const cid = await generateCID(state)
    console.log('State CID:', cid)

    await publishMessage(node, 'agent-tasks', {
        type: 'DEPLOY_COMPLETE',
        from: node.peerId.toString(),
        cid: cid,
        timestamp: Date.now()
    })

    const { publicKey } = generateKeys()
    const msg = encryptMessage(publicKey, 'deploy complete')
    console.log('PQC Message:', msg.cipherText.slice(0, 30) + '...')

    console.log('Deploy Agent: Running...')

    // Keep alive with heartbeat
    setInterval(async () => {
        await publishMessage(node, 'heartbeat', {
            agent: 'deploy-1',
            status: 'active',
            timestamp: Date.now()
        })
    }, 10000)

    process.on('SIGINT', async () => {
        console.log('Deploy Agent stopping...')
        await node.stop()
        process.exit(0)
    })
}

main()