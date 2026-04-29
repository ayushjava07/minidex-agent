import { createAgentNode, publishMessage, subscribeToTopic } from './network.js'
import { generateCID } from './cid-helper.js'
import { ethers } from 'ethers'
import 'dotenv/config'

const RPC_URL = process.env.RPC_URL 
const DEX_ADDRESS = process.env.DEX_ADDRESS
const DEX_ABI = ["function getReserves() view returns (uint, uint)"]

const lastHeartbeat = {}
let backupMonitoring = null

async function monitorPool(coveredBy) {
    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL)
        const dex = new ethers.Contract(DEX_ADDRESS, DEX_ABI, provider)
        const [resA, resB] = await dex.getReserves()

        const state = {
            agent: coveredBy,
            reserveA: resA.toString(),
            reserveB: resB.toString(),
            timestamp: Date.now()
        }

        const cid = await generateCID(state)
        console.log('[Report] Backup Pool Monitor:')
        console.log('  ReserveA:', ethers.formatEther(resA))
        console.log('  ReserveB:', ethers.formatEther(resB))
        console.log('  CID:', cid)
    } catch (err) {
        console.log('[Report] Pool error:', err.message)
    }
}

async function main() {
    console.log("=== Report Agent v2 ===")

    const node = await createAgentNode('report')

    subscribeToTopic(node, 'heartbeat', (data) => {
        console.log(`[Report] Heartbeat from ${data.agent}: ${data.status}`)
        lastHeartbeat[data.agent] = Date.now()

        if (data.agent === 'monitor' && backupMonitoring) {
            console.log('[Report] Monitor recovered - stopping backup')
            clearInterval(backupMonitoring)
            backupMonitoring = null
        }
    })

    subscribeToTopic(node, 'agent-tasks', (data) => {
        console.log(`[Report] Task received: ${data.type}`)
    })


    console.log('[Report] Waiting 15 seconds for all agents...')
    await new Promise(resolve => setTimeout(resolve, 15000))
    console.log('[Report] Active - monitoring started')

    // Fault detection
    setInterval(() => {
        const now = Date.now()

        if (Object.keys(lastHeartbeat).length === 0) {
            console.log('[Report] No heartbeats yet')
            return
        }

        for (const [agent, lastSeen] of Object.entries(lastHeartbeat)) {
            const silentFor = Math.floor((now - lastSeen) / 1000)

            if (silentFor > 30) {
                console.log(`[Report] ALERT: ${agent} DOWN for ${silentFor}s`)

                if (agent === 'monitor' && !backupMonitoring) {
                    console.log('[Report] Taking over monitor tasks...')
                    monitorPool('report-covering-monitor')
                    backupMonitoring = setInterval(() => {
                        monitorPool('report-covering-monitor')
                    }, 10000)
                }
            } else {
                console.log(`[Report] ${agent} ok - last seen ${silentFor}s ago`)
            }
        }
    }, 15000)

    // Heartbeat
    setInterval(async () => {
        await publishMessage(node, 'heartbeat', {
            agent: 'report',
            status: 'active',
            timestamp: new Date().toISOString()
        })
    }, 10000)

    const shutdown = async () => {
        if (backupMonitoring) clearInterval(backupMonitoring)
        console.log('\nStopping Report Agent...')
        await node.stop()
        process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
}

main().catch(console.error)