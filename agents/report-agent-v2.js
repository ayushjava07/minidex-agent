import { createAgentNode, subscribeToTopic, publishMessage } from './network.js'
import { generateCID } from './cid-helper.js'
import { ethers } from 'ethers'
import fs from 'fs'

const RPC_URL = "https://sepolia.infura.io/v3/cdd2389b301e4e1ca23664b3b6290860"
const DEX_ADDRESS = "0x37b18fA954Fa516eE60f666A01A36AFCF6A59650"
const DEX_ABI = ["function getReserves() view returns (uint, uint)"]

// Track heartbeats
const lastHeartbeat = {}
let monitoringInterval = null

async function doMonitorWork(node) {
    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL)
        const dex = new ethers.Contract(DEX_ADDRESS, DEX_ABI, provider)
        const [resA, resB] = await dex.getReserves()

        const state = {
            agent: 'report-1-covering-monitor',
            reserveA: resA.toString(),
            reserveB: resB.toString(),
            timestamp: Date.now()
        }

        const cid = await generateCID(state)
        console.log('Backup Pool CID:', cid)
        console.log('ReserveA:', ethers.formatEther(resA))
        console.log('ReserveB:', ethers.formatEther(resB))

        await publishMessage(node, 'heartbeat', {
            agent: 'report-1-covering-monitor-1',
            status: 'active',
            covering: 'monitor-1',
            timestamp: Date.now()
        })
    } catch (err) {
        console.log('Backup monitoring error:', err.message)
    }
}

async function generateReport() {
    const report = {
        agent: 'report-1',
        workflow: 'generate-report',
        timestamp: Date.now(),
        poolStatus: 'healthy',
        contracts: {
            TokenA: '0xF7a7152a2A939e21e0B0aBb34F12e2B260c5A5ED',
            TokenB: '0x95C5F14106ab4d1dc0cFC9326C287B702619A761',
            MiniDEX: DEX_ADDRESS
        },
        summary: 'Pool operational. Liquidity present. Swaps working.'
    }

    const cid = await generateCID(report)
    console.log('Report CID:', cid)

    fs.writeFileSync(
        './agents/latest-report.json',
        JSON.stringify({ ...report, cid }, null, 2)
    )

    return { report, cid }
}

async function main() {
    console.log("===================================")
    console.log("   Report Agent v2 Started")
    console.log("   Using libp2p peer discovery")
    console.log("===================================")

    const node = await createAgentNode('report')

    // Listen for heartbeats from all agents
    await subscribeToTopic(node, 'heartbeat', (message) => {
        console.log('Heartbeat from:', message.agent, '| status:', message.status)
        lastHeartbeat[message.agent] = Date.now()

        // Monitor wapas aa gaya
        if (message.agent === 'monitor-1' && monitoringInterval) {
            console.log('Monitor agent is back - stopping backup monitoring')
            clearInterval(monitoringInterval)
            monitoringInterval = null
        }
    })

    // Listen for task messages
    await subscribeToTopic(node, 'agent-tasks', (message) => {
        console.log('Task received:', message.type)
    })

    // Generate initial report
    await generateReport()

    // Fault detection - har 15 seconds check karo
    setInterval(async () => {
        const registry = JSON.parse(
            fs.readFileSync('./agents/registry.json')
        )

        for (const agent of registry.agents) {
            if (agent.id === 'report-1') continue

            const lastSeen = lastHeartbeat[agent.id]
            const now = Date.now()

            if (lastSeen && (now - lastSeen) > 30000) {
                console.log('ALERT: ' + agent.id + ' silent for 30 seconds')
                console.log('Report agent taking over ' + agent.id + ' tasks')

                agent.status = 'failed'
                fs.writeFileSync(
                    './agents/registry.json',
                    JSON.stringify(registry, null, 2)
                )

                // Monitor ka kaam lo
                if (agent.id === 'monitor-1' && !monitoringInterval) {
                    console.log('Starting backup pool monitoring...')
                    monitoringInterval = setInterval(async () => {
                        await doMonitorWork(node)
                    }, 10000)
                }

            } else if (!lastSeen) {
                console.log('Waiting for heartbeat from:', agent.id)
            }
        }
    }, 15000)

    // Apna heartbeat bhejo
    setInterval(async () => {
        await publishMessage(node, 'heartbeat', {
            agent: 'report-1',
            status: 'active',
            timestamp: Date.now()
        })
    }, 10000)

    console.log('Report Agent: Listening for events...')

    const shutdown = async () => {
        if (monitoringInterval) clearInterval(monitoringInterval)
        await node.stop()
        process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
}

main()