// agents/monitor-agent-v2.js
import { createAgentNode, subscribeToTopic, publishMessage } from './network.js'
import { generateCID } from './cid-helper.js'
import { ethers } from 'ethers'

const RPC_URL = "https://sepolia.infura.io/v3/cdd2389b301e4e1ca23664b3b6290860"
const DEX_ADDRESS = "0x37b18fA954Fa516eE60f666A01A36AFCF6A59650"
const DEX_ABI = ["function getReserves() view returns (uint, uint)"]

async function main() {
    console.log("═══════════════════════════════════")
    console.log("   👁️  Monitor Agent v2 Started")
    console.log("   Using libp2p peer discovery")
    console.log("═══════════════════════════════════")

    const node = await createAgentNode('monitor')

    // Listen for tasks from other agents
    await subscribeToTopic(node, 'agent-tasks', async (message) => {
        console.log('\n📨 Received message:', message.type)

        if (message.type === 'DEPLOY_COMPLETE') {
            console.log('🔄 Deploy detected, starting monitoring...')
            await monitorPool()
        }
    })

    // Start continuous monitoring
    setInterval(async () => {
        await monitorPool()
        await sendHeartbeat(node)
    }, 10000) // every 10 seconds

    console.log('\n✅ Monitor Agent: Listening for events...')
}

async function monitorPool() {
    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL)
        const dex = new ethers.Contract(DEX_ADDRESS, DEX_ABI, provider)
        const [resA, resB] = await dex.getReserves()

        const state = {
            agent: 'monitor-1',
            reserveA: resA.toString(),
            reserveB: resB.toString(),
            timestamp: Date.now()
        }

        const cid = await generateCID(state)
        console.log('\n📊 Pool State CID:', cid)
        console.log('   ReserveA:', ethers.formatEther(resA))
        console.log('   ReserveB:', ethers.formatEther(resB))
    } catch (err) {
        console.log('⚠️ Pool monitoring error:', err.message)
    }
}

async function sendHeartbeat(node) {
    await publishMessage(node, 'heartbeat', {
        agent: 'monitor-1',
        peerId: node.peerId.toString(),
        status: 'active',
        timestamp: Date.now()
    })
}

main()