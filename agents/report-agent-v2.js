import { createAgentNode, publishMessage, subscribeToTopic } from './network.js'
import { generateCID } from './cid-helper.js'
import { ethers } from 'ethers'
import fs from 'fs'

const RPC_URL = "https://sepolia.infura.io/v3/cdd2389b301e4e1ca23664b3b6290860"
const DEX_ADDRESS = "0x37b18fA954Fa516eE60f666A01A36AFCF6A59650"
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
        console.log(`[Report] Pool check - ReserveA: ${ethers.formatEther(resA)}`)
        console.log(`[Report] Pool CID: ${cid}`)
    } catch (err) {
        console.log('[Report] Pool check error:', err.message)
    }
}

async function main() {
    console.log("=== Report Agent v2 ===")

    const node = await createAgentNode('report')

    // Heartbeat suno - track karo
    subscribeToTopic(node, 'heartbeat', (data) => {
        console.log(`[Heartbeat] Received from ${data.agent}: ${data.status}`)
        lastHeartbeat[data.agent] = Date.now()

        // Monitor wapas aaya
        if (data.agent === 'monitor' && backupMonitoring) {
            console.log('[Report] Monitor recovered - stopping backup')
            clearInterval(backupMonitoring)
            backupMonitoring = null
        }
    })

    // Fault detection - har 15 seconds
    setInterval(async () => {
        const now = Date.now()

        for (const [agent, lastSeen] of Object.entries(lastHeartbeat)) {
            const silent = now - lastSeen

            if (silent > 30000) {
                console.log(`[Report] ALERT: ${agent} silent for ${Math.floor(silent/1000)}s`)

                if (agent === 'monitor' && !backupMonitoring) {
                    console.log('[Report] Taking over monitor tasks...')
                    backupMonitoring = setInterval(async () => {
                        await monitorPool('report-covering-monitor')
                    }, 10000)
                }
            }
        }
    }, 15000)

    // Wait for all agents
    console.log('Waiting 15 seconds for all agents...')
    await new Promise(resolve => setTimeout(resolve, 15000))
    console.log('Starting heartbeat...')

    // Apna heartbeat bhejo
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