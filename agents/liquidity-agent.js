import { createAgentNode, publishMessage, subscribeToTopic } from './network.js'
import { logTask, logExecution, printDAG } from './ipld-logger.js'
import { generateKeys, encryptMessage, decryptMessage } from './pqc.js'
import { ethers } from 'ethers'
import 'dotenv/config'

const RPC_URL     = process.env.RPC_URL
const DEX_ADDRESS = process.env.DEX_ADDRESS
const TOKEN_A     = process.env.TOKEN_A
const TOKEN_B     = process.env.TOKEN_B

const DEX_ABI = [
    "function getReserves() view returns (uint, uint)",
    "function addLiquidity(uint amountA, uint amountB) external",
]

const ERC20_ABI = [
    "function balanceOf(address) view returns (uint)"
]

// Thresholds
const IMBALANCE_RATIO   = 2.0   // alert if ratio > 2x
const LOW_LIQUIDITY_ETH = "100" // alert if reserve < 100 tokens

let rootTaskCID    = null
let lastRatioState = 'balanced'

// ── Wait for mDNS peer ────────────────────────────────
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

// ── Workflow 1: Check reserve ratio ──────────────────
async function checkReserveRatio(node) {
    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL)
        const dex      = new ethers.Contract(DEX_ADDRESS, DEX_ABI, provider)
        const [resA, resB] = await dex.getReserves()

        const reserveA = parseFloat(ethers.formatEther(resA))
        const reserveB = parseFloat(ethers.formatEther(resB))

        // Avoid division by zero
        const ratio = reserveB > 0 ? reserveA / reserveB : 999

        const taskCID = await logTask({
            peerId:      node.peerId.toString(),
            agent:       'liquidity',
            workflow:    'reserve-ratio-check',
            status:      'completed',
            explanation: 'Checked TokenA/TokenB reserve ratio in MiniDEX pool',
            inputs:      { contract: DEX_ADDRESS, network: 'sepolia' },
            outputs:     {
                reserveA: reserveA.toFixed(4),
                reserveB: reserveB.toFixed(4),
                ratio:    ratio.toFixed(4)
            },
            parentCID: rootTaskCID
        })

        await logExecution({
            peerId:  node.peerId.toString(),
            taskCID: taskCID,
            event:   'ratio_checked',
            agent:   'liquidity',
            outcome: 'success'
        })

        console.log('[Liquidity] Reserve Ratio Check:')
        console.log('  ReserveA :', reserveA.toFixed(4))
        console.log('  ReserveB :', reserveB.toFixed(4))
        console.log('  Ratio A/B:', ratio.toFixed(4))
        console.log('  Task CID :', taskCID)

        return { resA, resB, reserveA, reserveB, ratio, taskCID }

    } catch (err) {
        console.log('[Liquidity] Ratio check error:', err.message)

        await logTask({
            peerId:      node.peerId.toString(),
            agent:       'liquidity',
            workflow:    'reserve-ratio-check',
            status:      'failed',
            explanation: 'Failed to fetch reserves from MiniDEX — RPC error',
            inputs:      { contract: DEX_ADDRESS },
            parentCID:   rootTaskCID
        })

        return null
    }
}

// ── Workflow 2: Imbalance alert ───────────────────────
async function checkImbalanceAlert(node, ratioData) {
    if (!ratioData) return

    const { reserveA, reserveB, ratio, taskCID: parentCID } = ratioData

    const isImbalanced = ratio > IMBALANCE_RATIO || ratio < (1 / IMBALANCE_RATIO)
    const isLow        = reserveA < parseFloat(LOW_LIQUIDITY_ETH) ||
                         reserveB < parseFloat(LOW_LIQUIDITY_ETH)

    if (isImbalanced || isLow) {
        const reason = isImbalanced
            ? `Ratio ${ratio.toFixed(2)} exceeds threshold ${IMBALANCE_RATIO}`
            : `Reserve below ${LOW_LIQUIDITY_ETH} tokens`

        console.log(`[Liquidity] ALERT: ${reason}`)

        const alertTaskCID = await logTask({
            peerId:      node.peerId.toString(),
            agent:       'liquidity',
            workflow:    'imbalance-alert',
            status:      'completed',
            explanation: `Pool imbalance detected: ${reason}`,
            inputs:      {
                reserveA:  reserveA.toFixed(4),
                reserveB:  reserveB.toFixed(4),
                ratio:     ratio.toFixed(4),
                threshold: IMBALANCE_RATIO
            },
            parentCID: parentCID,
            escalate:  true
        })

        await logExecution({
            peerId:  node.peerId.toString(),
            taskCID: alertTaskCID,
            event:   'imbalance_alert_triggered',
            agent:   'liquidity',
            outcome: 'alert_sent'
        })

        // Broadcast alert to all agents
        await publishMessage(node, 'alerts', {
            type:      'POOL_IMBALANCE',
            reason:    reason,
            reserveA:  reserveA.toFixed(4),
            reserveB:  reserveB.toFixed(4),
            ratio:     ratio.toFixed(4),
            cid:       alertTaskCID,
            timestamp: new Date().toISOString()
        })

        lastRatioState = 'imbalanced'
        console.log('[Liquidity] Alert broadcast sent')
        console.log('[Liquidity] Alert CID:', alertTaskCID)

    } else {
        if (lastRatioState === 'imbalanced') {
            console.log('[Liquidity] Pool rebalanced — ratio normal')
            lastRatioState = 'balanced'
        } else {
            console.log('[Liquidity] Pool balanced — no action needed')
        }
    }
}

// ── Workflow 3: Rebalance suggestion ─────────────────
async function suggestRebalance(node, ratioData) {
    if (!ratioData) return
    if (lastRatioState !== 'imbalanced') return

    const { reserveA, reserveB, ratio } = ratioData

    // Simple suggestion: how much of the excess token to add
    let suggestion = ''
    let addA = '0'
    let addB = '0'

    if (ratio > IMBALANCE_RATIO) {
        // Too much A relative to B — suggest adding B
        const targetB = reserveA / IMBALANCE_RATIO
        addB = (targetB - reserveB).toFixed(4)
        suggestion = `Add ${addB} TokenB to rebalance pool`
    } else {
        // Too much B relative to A — suggest adding A
        const targetA = reserveB / IMBALANCE_RATIO
        addA = (targetA - reserveA).toFixed(4)
        suggestion = `Add ${addA} TokenA to rebalance pool`
    }

    console.log('[Liquidity] Rebalance Suggestion:', suggestion)

    const rebalanceTaskCID = await logTask({
        peerId:      node.peerId.toString(),
        agent:       'liquidity',
        workflow:    'rebalance-suggestion',
        status:      'completed',
        explanation: `Calculated optimal rebalance amounts for pool correction`,
        inputs:      {
            currentRatio: ratio.toFixed(4),
            targetRatio:  '1.0'
        },
        outputs: {
            suggestion: suggestion,
            addTokenA:  addA,
            addTokenB:  addB
        },
        parentCID: rootTaskCID
    })

    await logExecution({
        peerId:  node.peerId.toString(),
        taskCID: rebalanceTaskCID,
        event:   'rebalance_suggested',
        agent:   'liquidity',
        outcome: 'success'
    })

    // Broadcast suggestion to other agents
    await publishMessage(node, 'agent-tasks', {
        type:       'REBALANCE_SUGGESTION',
        from:       node.peerId.toString(),
        suggestion: suggestion,
        addTokenA:  addA,
        addTokenB:  addB,
        cid:        rebalanceTaskCID,
        timestamp:  new Date().toISOString()
    })

    console.log('[Liquidity] Rebalance CID:', rebalanceTaskCID)
    printDAG(rootTaskCID)
}

// ── Main ──────────────────────────────────────────────
async function main() {
    console.log("=== Liquidity Manager Agent v1 ===")

    const node = await createAgentNode('liquidity')

    generateKeys('liquidity')
    console.log('[PQC] Liquidity agent keys ready')

    rootTaskCID = await logTask({
        peerId:      node.peerId.toString(),
        agent:       'liquidity',
        workflow:    'liquidity-agent-startup',
        status:      'in-progress',
        explanation: 'Liquidity Manager agent started - monitoring pool balance and health',
        inputs:      { role: 'liquidity', contract: DEX_ADDRESS }
    })

    // Listen to heartbeats
    subscribeToTopic(node, 'heartbeat', (data) => {
        console.log(`[Liquidity] Heartbeat from ${data.agent}: ${data.status}`)
    })

    // Listen to tasks
    subscribeToTopic(node, 'agent-tasks', async (data) => {
        console.log(`[Liquidity] Task received: ${data.type}`)

        // If deploy complete — start monitoring
        if (data.type === 'DEPLOY_COMPLETE') {
            console.log('[Liquidity] Deploy complete received — checking pool state')
            const ratioData = await checkReserveRatio(node)
            await checkImbalanceAlert(node, ratioData)
        }
    })

    // Listen to alerts from monitor
    subscribeToTopic(node, 'alerts', async (data) => {
        if (data.type === 'LOW_LIQUIDITY') {
            console.log('[Liquidity] Low liquidity alert received from monitor')
            const ratioData = await checkReserveRatio(node)
            await suggestRebalance(node, ratioData)
        }
    })

    console.log('[Liquidity] Waiting for peers via mDNS...')
    await waitForPeer(node, 15_000)
    console.log('[Liquidity] Active — starting pool health monitoring')

    // Run all 3 workflows immediately
    const ratioData = await checkReserveRatio(node)
    await checkImbalanceAlert(node, ratioData)
    await suggestRebalance(node, ratioData)

    // Repeat every 30 seconds
    setInterval(async () => {
        const data = await checkReserveRatio(node)
        await checkImbalanceAlert(node, data)
        await suggestRebalance(node, data)
    }, 30000)

    // Heartbeat
    setInterval(async () => {
        await publishMessage(node, 'heartbeat', {
            agent:     'liquidity',
            status:    'active',
            timestamp: new Date().toISOString()
        })
    }, 10000)

    const shutdown = async () => {
        await logTask({
            peerId:      node.peerId.toString(),
            agent:       'liquidity',
            workflow:    'liquidity-agent-shutdown',
            status:      'completed',
            explanation: 'Liquidity Manager agent shutting down gracefully',
            parentCID:   rootTaskCID
        })

        console.log('\nStopping Liquidity Manager Agent...')
        await node.stop()
        process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
}

main().catch(console.error)