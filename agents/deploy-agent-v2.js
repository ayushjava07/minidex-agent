import { createAgentNode, publishMessage, subscribeToTopic } from './network.js'

async function main() {
  console.log("=== Deploy Agent v2 ===")
  
  const node = await createAgentNode('deploy')

  subscribeToTopic(node, 'heartbeat', (data) => {
    console.log(`[Heartbeat] Received from ${data.agent}: ${data.status}`)
  })

  // 15 seconds wait karo - sab agents start hone do
  console.log('Waiting 15 seconds for all agents to start...')
  await new Promise(resolve => setTimeout(resolve, 15000))
  console.log('Starting heartbeat...')

  // Pehla heartbeat turant bhejo
  await publishMessage(node, 'heartbeat', {
    agent: 'deploy',
    status: 'active',
    timestamp: new Date().toISOString()
  })

  // Phir har 10 seconds
  setInterval(async () => {
    try {
      await publishMessage(node, 'heartbeat', {
        agent: 'deploy',
        status: 'active',
        timestamp: new Date().toISOString()
      })
    } catch (err) {
      console.error('Failed to send heartbeat:', err.message)
    }
  }, 10000)

  const shutdown = async () => {
    console.log('\nStopping Deploy Agent...')
    await node.stop()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch(console.error)