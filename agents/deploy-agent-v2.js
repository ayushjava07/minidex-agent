import { createAgentNode, publishMessage, subscribeToTopic } from './network.js'
import { logTask, logExecution, printDAG } from './ipld-logger.js'
import { generateKeys, encryptMessage } from './pqc.js'
import 'dotenv/config'

let rootTaskCID = null

// ── Wait for mDNS peer before starting workflows ──────
async function waitForPeer(node, timeoutMs = 15000) {
    if (node.getConnections().length > 0) {
        console.log('[Network] Peers already connected')
        return
    }

    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            console.log('[Network] No peers found — running solo')
            resolve()
        }, timeoutMs)

        node.addEventListener('peer:connect', () => {
            clearTimeout(timer)
            console.log('[Network] Peer connected — starting workflows')
            resolve()
        }, { once: true })
    })
}

async function main() {
    console.log("=== Deploy Agent v2 ===")

    const node = await createAgentNode('deploy')

    const myKeys = generateKeys('deploy')
    console.log('[PQC] Deploy agent keys ready')

    rootTaskCID = await logTask({
        peerId:      node.peerId.toString(),
        agent:       'deploy',
        workflow:    'deploy-agent-startup',
        status:      'in-progress',
        explanation: 'Deploy agent started',
        inputs:      { role: 'deploy', network: 'sepolia' }
    })

    subscribeToTopic(node, 'heartbeat', (data) => {
        console.log(`[Deploy] Heartbeat from ${data.agent}: ${data.status}`)
    })

    subscribeToTopic(node, 'agent-tasks', (data) => {
        console.log(`[Deploy] Task received: ${data.type}`)
    })

    // ── Wait for mDNS — replaces hardcoded 15s sleep ──
    console.log('[Deploy] Waiting for peers via mDNS...')
    await waitForPeer(node, 15_000)
    console.log('[Deploy] Active')

    // Workflow 1: Contract deployment
    const deployTaskCID = await logTask({
        peerId:      node.peerId.toString(),
        agent:       'deploy',
        workflow:    'contract-deployment',
        status:      'completed',
        explanation: 'ERC20 tokens and MiniDEX deployed and verified on Sepolia testnet',
        inputs:      { network: 'sepolia', contracts: ['TokenA', 'TokenB', 'MiniDEX'] },
        outputs:     {
            tokenA: process.env.TOKEN_A,
            tokenB: process.env.TOKEN_B,
            dex:    process.env.DEX_ADDRESS
        },
        parentCID: rootTaskCID
    })

    await logExecution({
        peerId:  node.peerId.toString(),
        taskCID: deployTaskCID,
        event:   'contracts_deployed',
        agent:   'deploy',
        outcome: 'success'
    })

    console.log('[Deploy] Contract deployment logged')
    console.log('[Deploy] Task CID:', deployTaskCID)

    // Workflow 2: PQC encrypted broadcast
    try {
        const encrypted = encryptMessage('monitor', JSON.stringify({
            type: 'DEPLOY_COMPLETE',
            contracts: {
                tokenA: process.env.TOKEN_A,
                tokenB: process.env.TOKEN_B,
                dex:    process.env.DEX_ADDRESS
            }
        }))

        // null check
        if (encrypted) {
            await publishMessage(node, 'agent-tasks', {
                type:             'DEPLOY_COMPLETE',
                from:             node.peerId.toString(),
                targetRole:       'monitor', 
                cipherText:       encrypted.cipherText,
                encryptedMessage: encrypted.encryptedMessage,
                iv:               encrypted.iv,
                cid:              deployTaskCID,
                timestamp:        new Date().toISOString()
            })

            const pqcTaskCID = await logTask({
                peerId:      node.peerId.toString(),
                agent:       'deploy',
                workflow:    'pqc-encrypted-broadcast',
                status:      'completed',
                explanation: 'Deploy complete signal encrypted with ML-KEM-768 + AES-256-CBC and sent to monitor',
                inputs:      { targetAgent: 'monitor', algorithm: 'ML-KEM-768 + AES-256-CBC' },
                parentCID:   deployTaskCID
            })

            await logExecution({
                peerId:  node.peerId.toString(),
                taskCID: pqcTaskCID,
                event:   'pqc_message_sent',
                agent:   'deploy',
                outcome: 'success'
            })

            console.log('[PQC] Encrypted message sent to monitor')

        } else {
            // Monitor key not found - send plain
            await publishMessage(node, 'agent-tasks', {
                type:      'DEPLOY_COMPLETE',
                from:      node.peerId.toString(),
                cid:       deployTaskCID,
                timestamp: new Date().toISOString()
            })

            await logTask({
                peerId:      node.peerId.toString(),
                agent:       'deploy',
                workflow:    'pqc-encrypted-broadcast',
                status:      'failed',
                explanation: 'Monitor public key not available yet - sent plain message as fallback',
                inputs:      { targetAgent: 'monitor', algorithm: 'ML-KEM-768 + AES-256-CBC' },
                parentCID:   deployTaskCID
            })

            console.log('[PQC] Monitor key not ready - plain message sent')
        }

    } catch(err) {
        console.log('[PQC] Error:', err.message)
    }

    // Workflow 3: Peer registration
    const peerTaskCID = await logTask({
        peerId:      node.peerId.toString(),
        agent:       'deploy',
        workflow:    'peer-registration',
        status:      'completed',
        explanation: 'Deploy agent registered in peer network with libp2p identity',
        inputs:      { peerId: node.peerId.toString(), protocol: '/atos/1.0.0' },
        parentCID:   rootTaskCID
    })

    await logExecution({
        peerId:  node.peerId.toString(),
        taskCID: peerTaskCID,
        event:   'peer_registered',
        agent:   'deploy',
        outcome: 'success'
    })

    console.log('[Deploy] Peer registration logged')

    printDAG(rootTaskCID)

    setInterval(async () => {
        await publishMessage(node, 'heartbeat', {
            agent:     'deploy',
            status:    'active',
            timestamp: new Date().toISOString()
        })
    }, 10000)

    const shutdown = async () => {
        await logTask({
            peerId:      node.peerId.toString(),
            agent:       'deploy',
            workflow:    'deploy-agent-shutdown',
            status:      'completed',
            explanation: 'Deploy agent shutting down gracefully',
            parentCID:   rootTaskCID
        })

        console.log('\nStopping Deploy Agent...')
        await node.stop()
        process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
}

main().catch(console.error)