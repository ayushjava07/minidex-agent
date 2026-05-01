import { createAgentNode, publishMessage, subscribeToTopic } from './network.js'
import { logTask, logExecution, printDAG } from './ipld-logger.js'
import { generateKeys, decryptMessage } from './pqc.js'
import { ethers } from 'ethers'
import 'dotenv/config'

const RPC_URL     = process.env.RPC_URL
const DEX_ADDRESS = process.env.DEX_ADDRESS
const DEX_ABI     = ["function getReserves() view returns (uint, uint)"]

let rootTaskCID = null

async function monitorPool(node) {
    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL)
        const dex      = new ethers.Contract(DEX_ADDRESS, DEX_ABI, provider)
        const [resA, resB] = await dex.getReserves()

        const taskCID = await logTask({
            peerId:      node.peerId.toString(),
            agent:       'monitor',
            workflow:    'monitor-pool',
            status:      'completed',
            explanation: 'Fetched live pool reserves from Sepolia MiniDEX contract',
            inputs:      { contract: DEX_ADDRESS, network: 'sepolia' },
            outputs:     {
                reserveA: ethers.formatEther(resA),
                reserveB: ethers.formatEther(resB)
            },
            parentCID: rootTaskCID
        })

        await logExecution({
            peerId:  node.peerId.toString(),
            taskCID: taskCID,
            event:   'pool_reserves_fetched',
            agent:   'monitor',
            outcome: 'success'
        })

        console.log('[Monitor] Pool State:')
        console.log('  ReserveA:', ethers.formatEther(resA))
        console.log('  ReserveB:', ethers.formatEther(resB))
        console.log('  Task CID:', taskCID)

        // Low liquidity alert - Workflow 3
        const minReserve = ethers.parseEther("100")
        if (resA < minReserve || resB < minReserve) {
            console.log('[Monitor] ALERT: Low liquidity detected!')

            await logTask({
                peerId:      node.peerId.toString(),
                agent:       'monitor',
                workflow:    'low-liquidity-alert',
                status:      'completed',
                explanation: 'Pool liquidity dropped below threshold of 100 tokens',
                inputs:      { threshold: '100', reserveA: ethers.formatEther(resA) },
                parentCID:   taskCID,
                escalate:    true
            })

            await publishMessage(node, 'alerts', {
                type:      'LOW_LIQUIDITY',
                reserveA:  resA.toString(),
                reserveB:  resB.toString(),
                timestamp: Date.now()
            })
        }

    } catch (err) {
        console.log('[Monitor] Pool error:', err.message)

        await logExecution({
            peerId:  node.peerId.toString(),
            taskCID: rootTaskCID || 'unknown',
            event:   'pool_check_failed',
            agent:   'monitor',
            outcome: 'failed'
        })
    }
}

async function main() {
    console.log("=== Monitor Agent v2 ===")

    const node = await createAgentNode('monitor')

    generateKeys('monitor')
    console.log('[PQC] Monitor agent keys ready')

    rootTaskCID = await logTask({
        peerId:      node.peerId.toString(),
        agent:       'monitor',
        workflow:    'monitor-agent-startup',
        status:      'in-progress',
        explanation: 'Monitor agent started - watching pool reserves on Sepolia',
        inputs:      { role: 'monitor', contract: DEX_ADDRESS }
    })

    
    subscribeToTopic(node, 'heartbeat', (data) => {
        console.log(`[Monitor] Heartbeat from ${data.agent}: ${data.status}`)
    })

    subscribeToTopic(node, 'agent-tasks', async (data) => {
        console.log(`[Monitor] Task received: ${data.type}`)

        if (data.encryptedMessage && data.cipherText && data.iv) {
            try {
                const plaintext = decryptMessage(
                    'monitor',
                    data.cipherText,
                    data.encryptedMessage,
                    data.iv
                )
                const message = JSON.parse(plaintext)
                console.log('[PQC] Decrypted message from deploy:')
                console.log('  Type     :', message.type)
                console.log('  Contracts:', message.contracts)

                await logTask({
                    peerId:      node.peerId.toString(),
                    agent:       'monitor',
                    workflow:    'pqc-message-received',
                    status:      'completed',
                    explanation: 'Received and decrypted PQC message from deploy agent using ML-KEM-768 + AES-256-CBC',
                    inputs:      { algorithm: 'ML-KEM-768 + AES-256-CBC', from: 'deploy' },
                    outputs:     { messageType: message.type },
                    parentCID:   rootTaskCID
                })

            } catch(err) {
                console.log('[PQC] Decrypt failed:', err.message)
            }
        }
    })

    console.log('[Monitor] Waiting 15 seconds for all agents...')
    await new Promise(resolve => setTimeout(resolve, 15000))
    console.log('[Monitor] Active - starting pool monitoring')

    await monitorPool(node)

    setInterval(() => monitorPool(node), 10000)

    setInterval(async () => {
        await publishMessage(node, 'heartbeat', {
            agent:     'monitor',
            status:    'active',
            timestamp: new Date().toISOString()
        })
    }, 10000)

    const shutdown = async () => {
        await logTask({
            peerId:      node.peerId.toString(),
            agent:       'monitor',
            workflow:    'monitor-agent-shutdown',
            status:      'completed',
            explanation: 'Monitor agent shutting down gracefully',
            parentCID:   rootTaskCID
        })

        console.log('\nStopping Monitor Agent...')
        await node.stop()
        process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
}

main().catch(console.error)