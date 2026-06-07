// scripts/testNetwork.js

import {
    createAgentNode,
    connectToAllPeers,
    publishMessage,
    subscribeToTopic,
    getNetworkStatus
} from '../agents/network.js'
import { validateNetworkRun } from './networkValidation.js'

const ROLES = ['deploy', 'monitor', 'report', 'liquidity', 'analytics']
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function main() {
    console.log('🚀 Starting all 5 ATOS agents...\n')

    // ── Phase 1: Start ALL agents first ───────────────
    // Everyone must be started before anyone tries to connect
    // So the registry is fully populated
    const nodes = []
    const broadcasts = []
    const deliveries = []

    for (const role of ROLES) {
        const node = await createAgentNode(role)
        nodes.push(node)
        await sleep(300)  // let TCP server bind cleanly
    }

    console.log(`\n✅ All 5 agents started`)
    console.log(`📋 Registry: ${[...nodes.map(n => n.role)].join(', ')}\n`)

    // ── Phase 2: Wait for TCP servers to be ready ─────
    console.log('⏳ Waiting 1s for all TCP servers to be ready...\n')
    await sleep(1000)

    // ── Phase 3: Connect everyone to everyone ─────────
    console.log('🔗 Connecting all agents...\n')
    for (const node of nodes) {
        await connectToAllPeers(node)
        await sleep(200)
    }

    // ── Phase 4: Network Status ───────────────────────
    await sleep(500)

    console.log('\n📊 Network Status:')
    for (const node of nodes) {
        const s   = getNetworkStatus(node)
        const bar = '█'.repeat(s.peers) + '░'.repeat(4 - s.peers)
        const ok  = s.peers === 4 ? '✅' : s.peers > 0 ? '⚠️ ' : '❌'
        console.log(`  ${s.role.padEnd(10)} [${bar}] ${s.peers}/4 peers ${ok}`)
    }

    // ── Phase 5: Subscribe to topics ──────────────────
    console.log('\n📬 Subscribing to topics...\n')
    for (const node of nodes) {
        subscribeToTopic(node, 'heartbeat', data => {
            deliveries.push({ sender: data.from, recipient: node.role, topic: 'heartbeat' })
            console.log(`  [${node.role}] 💓 heartbeat ← [${data.from}]: ${data.msg}`)
        })
        subscribeToTopic(node, 'alert', data => {
            deliveries.push({ sender: data.from, recipient: node.role, topic: 'alert' })
            console.log(`  [${node.role}] 🚨 alert ← [${data.from}]: ${data.message}`)
        })
        subscribeToTopic(node, 'task', data => {
            deliveries.push({ sender: data.from, recipient: node.role, topic: 'task' })
            console.log(`  [${node.role}] 📋 task ← [${data.from}]: ${data.action}`)
        })
    }

    // ── Phase 6: Broadcast Tests ───────────────────────
    console.log('\n' + '─'.repeat(52))
    console.log('📡 TEST 1: Deploy → heartbeat → all agents')
    console.log('─'.repeat(52))
    broadcasts.push({ sender: 'deploy', topic: 'heartbeat', result: await publishMessage(nodes[0], 'heartbeat', {
        from: 'deploy',
        msg : 'TokenA + TokenB + MiniDEX live on Sepolia',
        ts  : Date.now()
    }) })

    await sleep(1000)

    console.log('\n' + '─'.repeat(52))
    console.log('📡 TEST 2: Monitor → alert → all agents')
    console.log('─'.repeat(52))
    broadcasts.push({ sender: 'monitor', topic: 'alert', result: await publishMessage(nodes[1], 'alert', {
        from    : 'monitor',
        message : 'TokenA reserve below 1000 threshold',
        severity: 'high',
        ts      : Date.now()
    }) })

    await sleep(1000)

    console.log('\n' + '─'.repeat(52))
    console.log('📡 TEST 3: Report → task → all agents')
    console.log('─'.repeat(52))
    broadcasts.push({ sender: 'report', topic: 'task', result: await publishMessage(nodes[2], 'task', {
        from      : 'report',
        action    : 'generate-weekly-report',
        assignedTo: 'analytics',
        ts        : Date.now()
    }) })

    await sleep(1000)

    console.log('\n' + '─'.repeat(52))
    console.log('📡 TEST 4: Analytics → task → all agents')
    console.log('─'.repeat(52))
    broadcasts.push({ sender: 'analytics', topic: 'task', result: await publishMessage(nodes[4], 'task', {
        from  : 'analytics',
        action: 'calculate-tvl',
        ts    : Date.now()
    }) })

    await sleep(2000)

    // ── Phase 7: Final Status ──────────────────────────
    console.log('\n📊 Final Network Status:')
    const statuses = []
    for (const node of nodes) {
        const s   = getNetworkStatus(node)
        statuses.push(s)
        const bar = '█'.repeat(s.peers) + '░'.repeat(4 - s.peers)
        const ok  = s.peers === 4 ? '✅' : '❌'
        console.log(`  ${s.role.padEnd(10)} [${bar}] ${s.peers}/4 ${ok}`)
    }

    // ── Shutdown ───────────────────────────────────────
    console.log('\n🛑 Shutting down all agents...')
    for (const node of nodes) {
        await node.stop()
    }
    console.log('✅ All agents stopped. Test complete.\n')

    validateNetworkRun({ roles: ROLES, statuses, broadcasts, deliveries })
    console.log(`✅ Validated ${broadcasts.length} broadcasts across ${deliveries.length} recipient deliveries.\n`)
}

main().catch(err => {
    console.error('❌ Test failed:', err)
    process.exit(1)
})
