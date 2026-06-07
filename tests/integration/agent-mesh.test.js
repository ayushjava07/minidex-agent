import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockConnection, createMockLibp2pNode } from '../helpers/mocks.js'
import { AGENT_ROLES, AGENT_PORTS, makeMockPeerId } from '../helpers/fixtures.js'
import '../setup/libp2p.js'

let agentCounter = 0
async function configureCreateLibp2p() {
  const libp2pModule = await import('libp2p')
  libp2pModule.createLibp2p.mockImplementation(async () => {
    const id = `12D3KooWAgent${String(++agentCounter).padStart(3, '0')}`
    const peerId = { toString: () => id, equals: (other) => other && other.toString() === id }
    return createMockLibp2pNode({ peerId })
  })
}

describe('agent-mesh integration', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    agentCounter = 0
    await configureCreateLibp2p()
  })

  it('should create all 5 agents and form a full mesh', async () => {
    const { createAgentNode, connectToAllPeers, getNetworkStatus, agentRegistry } =
      await import('../../agents/network.js')

    const nodes = []
    for (const role of AGENT_ROLES) {
      const node = await createAgentNode(role)
      nodes.push(node)
    }

    for (const node of nodes) {
      await connectToAllPeers(node)
    }

    for (const node of nodes) {
      const status = getNetworkStatus(node)
      expect(status.peers).toBe(AGENT_ROLES.length - 1)
    }
  })

  it('should deliver broadcast messages to all peers', async () => {
    const { createAgentNode, connectToAllPeers, publishMessage, subscribeToTopic } =
      await import('../../agents/network.js')

    const received = {}
    const nodes = []

    for (const role of AGENT_ROLES) {
      const node = await createAgentNode(role)
      nodes.push(node)
      received[role] = []
      subscribeToTopic(node, 'broadcast-test', (data) => {
        received[role].push(data)
      })
    }

    for (const node of nodes) {
      await connectToAllPeers(node)
    }

    const result = await publishMessage(nodes[0], 'broadcast-test', { msg: 'hello' })
    expect(result.sent).toBe(AGENT_ROLES.length - 1)

    // Simulate message delivery on each receiving node
    const sender = nodes[0]
    for (let i = 1; i < nodes.length; i++) {
      if (nodes[i]._simulateMessage) {
        await nodes[i]._simulateMessage('broadcast-test', { msg: 'hello' }, sender.role)
      }
    }

    // Verify each non-sender agent received the message
    for (let i = 1; i < AGENT_ROLES.length; i++) {
      const role = AGENT_ROLES[i]
      expect(received[role].length).toBeGreaterThanOrEqual(1)
      if (received[role].length > 0) {
        expect(received[role][0]).toHaveProperty('msg', 'hello')
      }
    }
  })

  it('should handle agent start failure gracefully', async () => {
    const { createAgentNode } = await import('../../agents/network.js')
    await expect(createAgentNode('ghost-role')).rejects.toThrow('Unknown role')
  })

  it('should recover when a transient dial failure clears', async () => {
    const { createAgentNode, connectToAllPeers } = await import('../../agents/network.js')
    const nodes = []
    for (const role of AGENT_ROLES) {
      nodes.push(await createAgentNode(role))
    }

    nodes[0].dial.mockRejectedValueOnce(new Error('temporary partition'))

    const connected = await connectToAllPeers(nodes[0])

    expect(connected).toBe(AGENT_ROLES.length - 1)
    expect(nodes[0].dial).toHaveBeenCalledTimes(AGENT_ROLES.length)
  })

  it('should report degraded delivery during a partition and recover afterward', async () => {
    const { createAgentNode, publishMessage } = await import('../../agents/network.js')
    const nodes = []
    for (const role of AGENT_ROLES) {
      nodes.push(await createAgentNode(role))
    }

    const sender = nodes[0]
    sender.getConnections.mockReturnValue([])
    sender.dial.mockRejectedValue(new Error('network partition'))

    const degraded = await publishMessage(sender, 'heartbeat', { status: 'active' })
    expect(degraded).toEqual({ sent: 0, total: 0 })

    sender.dial.mockImplementation(async target => createMockConnection({ peerId: target }))
    const recovered = await publishMessage(sender, 'heartbeat', { status: 'active' })

    expect(recovered).toEqual({
      sent: AGENT_ROLES.length - 1,
      total: AGENT_ROLES.length - 1,
    })
  })
})
