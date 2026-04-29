import { createAgentNode, publishMessage, subscribeToTopic } from './network.js'
import { generateCID } from './cid-helper.js'
import { ethers } from 'ethers'

const RPC_URL = "https://sepolia.infura.io/v3/cdd2389b301e4e1ca23664b3b6290860"
const DEX_ADDRESS = "0x37b18fA954Fa516eE60f666A01A36AFCF6A59650"
const DEX_ABI = ["function getReserves() view returns (uint, uint)"]

async function monitorPool() {
    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL)
        const dex = new ethers.Contract(DEX_ADDRESS, DEX_ABI, provider)
        const [resA, resB] = await dex.getReserves()

        const state = {
            agent: 'monitor',
            reserveA: resA.toString(),
            reserveB: resB.toString(),
            timestamp: Date.now()
        }

        const cid = await generateCID(state)
        console.log('[Monitor] Pool State:')
        console.log('  ReserveA:', ethers.formatEther(resA))
        console.log('  ReserveB:', ethers.formatEther(resB))
        console.log('  CID:', cid)
    } catch (err) {
        console.log('[Monitor] Pool error:', err.message)
    }
}

async function main() {
    console.log("=== Monitor Agent v2 ===")

    const node = await createAgentNode('monitor')

    subscribeToTopic(node, 'heartbeat', (data) => {
        console.log(`[Monitor] Heartbeat from ${data.agent}: ${data.status}`)
    })

    console.log('[Monitor] Waiting 15 seconds for all agents...')
    await new Promise(resolve => setTimeout(resolve, 15000))
    console.log('[Monitor] Active - starting pool monitoring')

    // instantly pool check
    await monitorPool()

    // every 10 seconds pool check
    setInterval(() => monitorPool(), 10000)

    // every 10 seconds heartbeat
    setInterval(async () => {
        await publishMessage(node, 'heartbeat', {
            agent: 'monitor',
            status: 'active',
            timestamp: new Date().toISOString()
        })
    }, 10000)

    const shutdown = async () => {
        console.log('\nStopping Monitor Agent...')
        await node.stop()
        process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
}

main().catch(console.error)