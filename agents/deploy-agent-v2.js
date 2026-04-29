// agents/deploy-agent-v2.js
import { createAgentNode, publishMessage } from './network.js'
import { generateCID } from './cid-helper.js'
import { generateKeys, encryptMessage } from './pqc.js'

async function main() {
    console.log("═══════════════════════════════════")
    console.log("   🚀 Deploy Agent v2 Started")
    console.log("   Using libp2p peer discovery")
    console.log("═══════════════════════════════════")

    // libp2p node create karo
    const node = await createAgentNode('deploy')

    // Wait for peers
    console.log('\n⏳ Waiting for peers...')
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Workflow 1: Deploy
    const state = {
        agent: 'deploy-1',
        peerId: node.peerId.toString(),
        workflow: 'deploy',
        status: 'completed',
        timestamp: Date.now()
    }

    const cid = await generateCID(state)
    console.log('\n📦 State CID:', cid)

    // Publish to network via libp2p
    await publishMessage(node, 'agent-tasks', {
        type: 'DEPLOY_COMPLETE',
        from: node.peerId.toString(),
        cid: cid,
        timestamp: Date.now()
    })

    // PQC encrypt message
    const { publicKey } = generateKeys()
    const msg = encryptMessage(publicKey, 'deploy complete')
    console.log('🔐 PQC Message:', msg.cipherText.slice(0, 30) + '...')

    console.log('\n✅ Deploy Agent: All workflows complete')

    // Keep running
    process.on('SIGINT', async () => {
        await node.stop()
        process.exit(0)
    })
}

main()