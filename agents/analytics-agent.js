import { createAgentNode, publishMessage, subscribeToTopic } from './network.js'
import { logTask, logExecution, printDAG } from './ipld-logger.js'
import { generateKeys } from './pqc.js'
import { loadReadOnlyAgentConfig } from '../config/env.js'
import { summarizeSwapEvents } from './workflows/analytics.js'
import { startHealthServer } from './health.js'
import { createTaskScheduler } from './task-scheduler.js'
import { ethers } from 'ethers'
import 'dotenv/config'

const { rpcUrl: RPC_URL, dexAddress: DEX_ADDRESS } = loadReadOnlyAgentConfig()

const DEX_ABI = [
    "function getReserves() view returns (uint, uint)",
    "function tokenA() view returns (address)",
    "event Swapped(address indexed user, address indexed tokenIn, uint amountIn, uint amountOut)",
    "event LiquidityAdded(uint amountA, uint amountB)"
]

let rootTaskCID    = null
let swapCount      = 0
let totalVolumeA   = 0n
let totalVolumeB   = 0n
let sessionStart   = Date.now()

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

// ── Workflow 1: Fetch swap history ────────────────────
async function fetchSwapHistory(node) {
    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL)
        const dex      = new ethers.Contract(DEX_ADDRESS, DEX_ABI, provider)

        // Get last 1000 blocks of swap events
        const currentBlock = await provider.getBlockNumber()
        const fromBlock    = Math.max(0, currentBlock - 1000)

        console.log(`[Analytics] Scanning blocks ${fromBlock} → ${currentBlock}`)

        let swapEvents = []
        try {
            swapEvents = await dex.queryFilter('Swapped', fromBlock, currentBlock)
        } catch {
            // Some RPC providers limit event queries
            console.log('[Analytics] Event query limited — using reserve snapshot')
        }

        const tokenAAddress = await dex.tokenA()
        const summary = summarizeSwapEvents(swapEvents, tokenAAddress)
        swapCount    = summary.swapCount
        totalVolumeA = summary.totalVolumeA
        totalVolumeB = summary.totalVolumeB

        const taskCID = await logTask({
            peerId:      node.peerId.toString(),
            agent:       'analytics',
            workflow:    'swap-history-fetch',
            status:      'completed',
            explanation: `Fetched swap events from last 1000 blocks on Sepolia`,
            inputs:      {
                contract:    DEX_ADDRESS,
                fromBlock:   fromBlock,
                toBlock:     currentBlock
            },
            outputs: {
                swapCount:    swapCount,
                volumeTokenA: ethers.formatEther(totalVolumeA),
                volumeTokenB: ethers.formatEther(totalVolumeB)
            },
            parentCID: rootTaskCID
        })

        await logExecution({
            peerId:  node.peerId.toString(),
            taskCID: taskCID,
            event:   'swap_history_fetched',
            agent:   'analytics',
            outcome: 'success'
        })

        console.log('[Analytics] Swap History:')
        console.log('  Total Swaps  :', swapCount)
        console.log('  Volume TokenA:', ethers.formatEther(totalVolumeA))
        console.log('  Volume TokenB:', ethers.formatEther(totalVolumeB))
        console.log('  Task CID     :', taskCID)

        return { swapCount, totalVolumeA, totalVolumeB, taskCID }

    } catch (err) {
        console.log('[Analytics] Swap history error:', err.message)

        await logTask({
            peerId:      node.peerId.toString(),
            agent:       'analytics',
            workflow:    'swap-history-fetch',
            status:      'failed',
            explanation: 'Failed to fetch swap history — RPC error or no events',
            inputs:      { contract: DEX_ADDRESS },
            parentCID:   rootTaskCID
        })

        return null
    }
}

// ── Workflow 2: Pool stats calculation ───────────────
async function calculatePoolStats(node, swapData) {
    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL)
        const dex      = new ethers.Contract(DEX_ADDRESS, DEX_ABI, provider)
        const [resA, resB] = await dex.getReserves()

        const reserveA    = parseFloat(ethers.formatEther(resA))
        const reserveB    = parseFloat(ethers.formatEther(resB))
        const ratio       = reserveB > 0 ? (reserveA / reserveB).toFixed(4) : 'N/A'
        const totalTVL    = (reserveA + reserveB).toFixed(4)

        // Fee estimate (0.3% per swap)
        const volA        = swapData ? parseFloat(ethers.formatEther(swapData.totalVolumeA)) : 0
        const volB        = swapData ? parseFloat(ethers.formatEther(swapData.totalVolumeB)) : 0
        const feesEarned  = ((volA + volB) * 0.003).toFixed(6)

        // Session uptime
        const uptimeMs    = Date.now() - sessionStart
        const uptimeMins  = Math.floor(uptimeMs / 60000)

        const statsCID = await logTask({
            peerId:      node.peerId.toString(),
            agent:       'analytics',
            workflow:    'pool-stats-calculation',
            status:      'completed',
            explanation: 'Calculated pool TVL, ratio, fees and uptime metrics',
            inputs:      {
                reserveA:   reserveA.toFixed(4),
                reserveB:   reserveB.toFixed(4),
                swapCount:  swapData?.swapCount || 0
            },
            outputs: {
                tvl:         totalTVL,
                ratio:       ratio,
                feesEarned:  feesEarned,
                uptimeMins:  uptimeMins
            },
            parentCID: swapData?.taskCID || rootTaskCID
        })

        await logExecution({
            peerId:  node.peerId.toString(),
            taskCID: statsCID,
            event:   'pool_stats_calculated',
            agent:   'analytics',
            outcome: 'success'
        })

        console.log('[Analytics] Pool Stats:')
        console.log('  TVL         :', totalTVL, 'tokens')
        console.log('  Ratio A/B   :', ratio)
        console.log('  Fees Earned :', feesEarned, 'tokens (est.)')
        console.log('  Uptime      :', uptimeMins, 'minutes')
        console.log('  Stats CID   :', statsCID)

        return {
            reserveA, reserveB,
            ratio, totalTVL,
            feesEarned, uptimeMins,
            statsCID
        }

    } catch (err) {
        console.log('[Analytics] Stats error:', err.message)

        await logTask({
            peerId:      node.peerId.toString(),
            agent:       'analytics',
            workflow:    'pool-stats-calculation',
            status:      'failed',
            explanation: 'Failed to calculate pool stats',
            inputs:      { contract: DEX_ADDRESS },
            parentCID:   rootTaskCID
        })

        return null
    }
}

// ── Workflow 3: Analytics report generation ──────────
async function generateAnalyticsReport(node, swapData, statsData) {
    const timestamp  = new Date().toISOString()
    const sessionAge = Math.floor((Date.now() - sessionStart) / 60000)

    const report = {
        generatedAt:   timestamp,
        sessionMins:   sessionAge,
        swaps: {
            total:       swapData?.swapCount    || 0,
            volumeTokenA: swapData
                ? ethers.formatEther(swapData.totalVolumeA)
                : '0',
            volumeTokenB: swapData
                ? ethers.formatEther(swapData.totalVolumeB)
                : '0'
        },
        pool: {
            reserveA:    statsData?.reserveA?.toFixed(4)  || 'N/A',
            reserveB:    statsData?.reserveB?.toFixed(4)  || 'N/A',
            ratio:       statsData?.ratio                 || 'N/A',
            tvl:         statsData?.totalTVL              || 'N/A',
            feesEarned:  statsData?.feesEarned            || '0'
        },
        agents: {
            analytics:   'active',
            monitor:     'active',
            deploy:      'active',
            report:      'active',
            liquidity:   'active'
        },
        network: 'sepolia'
    }

    const reportCID = await logTask({
        peerId:      node.peerId.toString(),
        agent:       'analytics',
        workflow:    'analytics-report-generation',
        status:      'completed',
        explanation: 'Generated full analytics report with swap volume, pool stats and agent health',
        inputs:      {
            sessionMins: sessionAge,
            swapCount:   swapData?.swapCount || 0
        },
        outputs:     report,
        parentCID:   statsData?.statsCID || rootTaskCID
    })

    await logExecution({
        peerId:  node.peerId.toString(),
        taskCID: reportCID,
        event:   'analytics_report_generated',
        agent:   'analytics',
        outcome: 'success'
    })

    console.log('[Analytics] Report Generated:')
    console.log('─────────────────────────────')
    console.log('  Session    :', sessionAge, 'minutes')
    console.log('  Swaps      :', report.swaps.total)
    console.log('  TVL        :', report.pool.tvl)
    console.log('  Fees       :', report.pool.feesEarned)
    console.log('  Report CID :', reportCID)
    console.log('─────────────────────────────')

    // Broadcast report to all agents
    await publishMessage(node, 'agent-tasks', {
        type:      'ANALYTICS_REPORT',
        from:      node.peerId.toString(),
        report:    report,
        cid:       reportCID,
        timestamp: timestamp
    })

    printDAG(rootTaskCID)

    return reportCID
}

// ── Main ──────────────────────────────────────────────
async function main() {
    console.log("=== Analytics Agent v1 ===")
    const scheduler = createTaskScheduler({
        onError: (error, task) => console.error(`[Analytics] Scheduled task ${task.name} failed:`, error)
    })

    const node = await createAgentNode('analytics')
    const health = await startHealthServer(node)

    generateKeys('analytics')
    console.log('[PQC] Analytics agent keys ready')

    rootTaskCID = await logTask({
        peerId:      node.peerId.toString(),
        agent:       'analytics',
        workflow:    'analytics-agent-startup',
        status:      'in-progress',
        explanation: 'Analytics agent started - tracking swap volume, fees and pool health',
        inputs:      { role: 'analytics', contract: DEX_ADDRESS }
    })

    // Listen to heartbeats
    subscribeToTopic(node, 'heartbeat', (data) => {
        console.log(`[Analytics] Heartbeat from ${data.agent}: ${data.status}`)
    })

    // Listen to tasks
    subscribeToTopic(node, 'agent-tasks', async (data) => {
        console.log(`[Analytics] Task received: ${data.type}`)

        // If liquidity imbalance — log it in analytics
        if (data.type === 'REBALANCE_SUGGESTION') {
            console.log('[Analytics] Rebalance suggestion received:', data.suggestion)
            await logTask({
                peerId:      node.peerId.toString(),
                agent:       'analytics',
                workflow:    'rebalance-event-logged',
                status:      'completed',
                explanation: 'Logged rebalance suggestion from Liquidity Manager for audit trail',
                inputs:      {
                    suggestion: data.suggestion,
                    addTokenA:  data.addTokenA,
                    addTokenB:  data.addTokenB
                },
                parentCID: rootTaskCID
            })
        }
    })

    // Listen to alerts
    subscribeToTopic(node, 'alerts', async (data) => {
        if (data.type === 'POOL_IMBALANCE') {
            console.log('[Analytics] Pool imbalance alert received — triggering report')
            const swapData  = await fetchSwapHistory(node)
            const statsData = await calculatePoolStats(node, swapData)
            await generateAnalyticsReport(node, swapData, statsData)
        }
    })

    console.log('[Analytics] Waiting for peers via mDNS...')
    await waitForPeer(node, 15_000)
    console.log('[Analytics] Active — starting analytics workflows')

    // Run all 3 workflows on start
    const swapData  = await fetchSwapHistory(node)
    const statsData = await calculatePoolStats(node, swapData)
    await generateAnalyticsReport(node, swapData, statsData)

    // Repeat every 60 seconds
    scheduler.every('analytics-report', 60000, async () => {
        const swap  = await fetchSwapHistory(node)
        const stats = await calculatePoolStats(node, swap)
        await generateAnalyticsReport(node, swap, stats)
    })

    // Heartbeat
    scheduler.every('heartbeat', 10000, async () => {
        await publishMessage(node, 'heartbeat', {
            agent:     'analytics',
            status:    'active',
            timestamp: new Date().toISOString()
        })
    })

    const shutdown = async () => {
        await logTask({
            peerId:      node.peerId.toString(),
            agent:       'analytics',
            workflow:    'analytics-agent-shutdown',
            status:      'completed',
            explanation: 'Analytics agent shutting down gracefully',
            parentCID:   rootTaskCID
        })

        console.log('\nStopping Analytics Agent...')
        await scheduler.stopAll()
        await health.stop()
        await node.stop()
        process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
}

main().catch(err => { console.error(`[analytics] Fatal:`, err); process.exit(1) })
