import { createAgentNode, publishMessage, subscribeToTopic } from './network.js'
import { logTask, logExecution, getFullDAG, printDAG } from './ipld-logger.js'
import { generateKeys, encryptMessage, decryptMessage } from './pqc.js'
import { ethers } from 'ethers'
import 'dotenv/config'

const RPC_URL    = process.env.RPC_URL
const DEX_ADDRESS = process.env.DEX_ADDRESS
const DEX_ABI    = ["function getReserves() view returns (uint, uint)"]

const lastHeartbeat = {}
let backupMonitoring = null
let rootTaskCID = null

async function monitorPool(node, coveredBy) {
    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL)
        const dex      = new ethers.Contract(DEX_ADDRESS, DEX_ABI, provider)
        const [resA, resB] = await dex.getReserves()

        // IPLD task log
        const taskCID = await logTask({
            peerId:      node.peerId.toString(),
            agent:       coveredBy,
            workflow:    'backup-pool-monitor',
            status:      'completed',
            explanation: 'Report agent covering failed monitor agent - fetching pool reserves',
            inputs:  { contract: DEX_ADDRESS, network: 'sepolia' },
            outputs: {
                reserveA: ethers.formatEther(resA),
                reserveB: ethers.formatEther(resB)
            },
            parentCID: rootTaskCID
        })

        await logExecution({
            peerId:  node.peerId.toString(),
            taskCID: taskCID,
            event:   'backup_pool_check',
            agent:   coveredBy,
            outcome: 'success'
        })

        console.log('[Report] Backup Pool Monitor:')
        console.log('  ReserveA:', ethers.formatEther(resA))
        console.log('  ReserveB:', ethers.formatEther(resB))
        console.log('  Task CID:', taskCID)

    } catch (err) {
        console.log('[Report] Pool error:', err.message)

        await logExecution({
            peerId:  node.peerId.toString(),
            taskCID: rootTaskCID || 'unknown',
            event:   'backup_pool_check_failed',
            agent:   coveredBy,
            outcome: 'failed'
        })
    }
}

async function main() {
    console.log("=== Report Agent v2 ===")

    const node = await createAgentNode('report')

    // PQC keys banaye
    const myKeys = generateKeys('report')
    console.log('[PQC] Report agent keys ready')

    // Root task ko log kare
    rootTaskCID = await logTask({
        peerId:      node.peerId.toString(),
        agent:       'report',
        workflow:    'report-agent-startup',
        status:      'in-progress',
        explanation: 'Report agent started - monitoring system health and fault recovery',
        inputs:  { role: 'report', network: 'sepolia' }
    })

    // Heartbeat suno
    subscribeToTopic(node, 'heartbeat', async (data) => {
        console.log(`[Report] Heartbeat from ${data.agent}: ${data.status}`)
        lastHeartbeat[data.agent] = Date.now()

        // Monitor wapas aaya
        if (data.agent === 'monitor' && backupMonitoring) {
            console.log('[Report] Monitor recovered - stopping backup')
            clearInterval(backupMonitoring)
            backupMonitoring = null

            await logTask({
                peerId:      node.peerId.toString(),
                agent:       'report',
                workflow:    'monitor-recovery-detected',
                status:      'completed',
                explanation: 'Monitor agent came back online - backup monitoring stopped',
                parentCID:   rootTaskCID
            })
        }
    })

    // Agent task suno
    subscribeToTopic(node, 'agent-tasks', async (data) => {
        console.log(`[Report] Task received: ${data.type}`)

        // Agar encrypted message aaya
        if (data.encryptedMessage) {
            try {
                const plaintext = decryptMessage(
                    'report',
                    data.cipherText,
                    data.encryptedMessage,
                    data.iv
                )
                console.log('[PQC] Decrypted task message:', plaintext)
            } catch(err) {
                console.log('[PQC] Decrypt failed:', err.message)
            }
        }
    })

    console.log('[Report] Waiting 15 seconds for all agents...')
    await new Promise(resolve => setTimeout(resolve, 15000))
    console.log('[Report] Active - monitoring started')

    // Fault detection har 15 second
    setInterval(async () => {
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

                    // IPLD log
                    const faultTaskCID = await logTask({
                        peerId:      node.peerId.toString(),
                        agent:       'report',
                        workflow:    'fault-recovery',
                        status:      'in-progress',
                        explanation: `Monitor agent failed - report agent taking over pool monitoring`,
                        inputs:  { failedAgent: agent, silentFor },
                        parentCID: rootTaskCID
                    })

                    await logExecution({
                        peerId:  node.peerId.toString(),
                        taskCID: faultTaskCID,
                        event:   'agent_failure_detected',
                        agent:   'report',
                        outcome: 'recovery_started'
                    })

                    // Turant check kare
                    await monitorPool(node, 'report-covering-monitor')

                    // Har 10 second
                    backupMonitoring = setInterval(() => {
                        monitorPool(node, 'report-covering-monitor')
                    }, 10000)
                }

            } else {
                console.log(`[Report] ${agent} ok - last seen ${silentFor}s ago`)
            }
        }

        // DAG print kare
        if (rootTaskCID) {
            printDAG(rootTaskCID)
        }

    }, 15000)

    // Heartbeat bheje
    setInterval(async () => {
        await publishMessage(node, 'heartbeat', {
            agent:     'report',
            status:    'active',
            timestamp: new Date().toISOString()
        })
    }, 10000)

    const shutdown = async () => {
        if (backupMonitoring) clearInterval(backupMonitoring)

        await logTask({
            peerId:      node.peerId.toString(),
            agent:       'report',
            workflow:    'report-agent-shutdown',
            status:      'completed',
            explanation: 'Report agent shutting down gracefully',
            parentCID:   rootTaskCID
        })

        console.log('\nStopping Report Agent...')
        await node.stop()
        process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
}

main().catch(console.error)