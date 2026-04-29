import { createAgentNode, publishMessage, subscribeToTopic } from './network.js'
import { generateCID } from './cid-helper.js'
import { generateKeys, encryptMessage } from './pqc.js'

async function main() {
    console.log("=== Deploy Agent v2 ===")

    const node = await createAgentNode('deploy')

    subscribeToTopic(node, 'heartbeat', (data) => {
        console.log(`[Deploy] Heartbeat from ${data.agent}: ${data.status}`)
    })

    subscribeToTopic(node, 'agent-tasks', (data) => {
        console.log(`[Deploy] Task received: ${data.type}`)
    })

    console.log('[Deploy] Waiting 15 seconds for all agents...')
    await new Promise(resolve => setTimeout(resolve, 15000))
    console.log('[Deploy] Active')

    // Deploy state
    const state = {
        agent: 'deploy',
        workflow: 'deploy',
        status: 'completed',
        timestamp: Date.now()
    }
    const cid = await generateCID(state)
    console.log('[Deploy] State CID:', cid)

    // PQC demo
    const { publicKey } = generateKeys()
    const msg = encryptMessage(publicKey, 'deploy complete')
    console.log('[Deploy] PQC Message:', msg.cipherText.slice(0, 30) + '...')

    // Broadcast deploy complete
    await publishMessage(node, 'agent-tasks', {
        type: 'DEPLOY_COMPLETE',
        agent: 'deploy',
        cid: cid,
        timestamp: new Date().toISOString()
    })

    // Heartbeat
    setInterval(async () => {
        await publishMessage(node, 'heartbeat', {
            agent: 'deploy',
            status: 'active',
            timestamp: new Date().toISOString()
        })
    }, 10000)

    const shutdown = async () => {
        console.log('\nStopping Deploy Agent...')
        await node.stop()
        process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
}

main().catch(console.error)