import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockLibp2pNode, createMockConnection, createMockStream } from '../helpers/mocks.js'
import { AGENT_ROLES, AGENT_PORTS, PROTOCOL, makeMockPeerId } from '../helpers/fixtures.js'
import '../setup/libp2p.js'

const AGENT_NAMES = AGENT_ROLES

let agentCounter = 0
async function configureCreateLibp2p() {
  const libp2pModule = await import('libp2p')
  libp2pModule.createLibp2p.mockImplementation(async () => {
    const id = `12D3KooWAgent${String(++agentCounter).padStart(3, '0')}`
    const peerId = { toString: () => id, equals: (other) => other && other.toString() === id }
    return createMockLibp2pNode({ peerId })
  })
}

describe('network.js — createAgentNode', () => {
  let network

  beforeEach(async () => {
    vi.clearAllMocks()
    agentCounter = 0
    await configureCreateLibp2p()
    network = await import('../../agents/network.js')
  })

  it('should create an agent node with correct role', async () => {
    const { createAgentNode } = network
    const node = await createAgentNode('deploy')
    expect(node).toBeDefined()
    expect(node.role).toBe('deploy')
  })

  it('should register the agent in the shared registry', async () => {
    const { createAgentNode, agentRegistry } = network
    await createAgentNode('monitor')
    expect(agentRegistry.has('monitor')).toBe(true)
    const entry = agentRegistry.get('monitor')
    expect(entry).toHaveProperty('port', AGENT_PORTS.monitor)
    expect(entry).toHaveProperty('peerId')
  })

  it('should throw on unknown role', async () => {
    const { createAgentNode } = network
    await expect(createAgentNode('unknown-role')).rejects.toThrow('Unknown role')
  })

  it('should register all 5 agents in the registry', async () => {
    const { createAgentNode, agentRegistry } = network
    for (const role of AGENT_NAMES) {
      await createAgentNode(role)
    }
    for (const role of AGENT_NAMES) {
      expect(agentRegistry.has(role)).toBe(true)
      expect(agentRegistry.get(role).port).toBe(AGENT_PORTS[role])
    }
  })
})

describe('network.js — connectToAllPeers', () => {
  let network, agentRegistry

  beforeEach(async () => {
    vi.clearAllMocks()
    agentCounter = 0
    await configureCreateLibp2p()
    network = await import('../../agents/network.js')
    agentRegistry = network.agentRegistry
  })

  it('should connect to all registered peers', async () => {
    const { createAgentNode, connectToAllPeers } = network
    const nodes = []
    for (const role of AGENT_NAMES) {
      nodes.push(await createAgentNode(role))
    }

    const deploy = nodes[0]
    const connected = await connectToAllPeers(deploy)
    expect(connected).toBe(AGENT_NAMES.length - 1)
  })

  it('should return 0 when registry is empty', async () => {
    const { connectToAllPeers } = network
    agentRegistry.clear()
    const node = createMockLibp2pNode({ role: 'deploy' })
    const connected = await connectToAllPeers(node)
    expect(connected).toBe(0)
  })

  it('should skip self when connecting', async () => {
    const { createAgentNode, connectToAllPeers } = network
    await createAgentNode('deploy')
    await createAgentNode('monitor')

    const deployPeerId = agentRegistry.get('deploy').peerId
    const deploy = createMockLibp2pNode({ role: 'deploy', peerId: deployPeerId })
    agentRegistry.set('deploy', { peerId: deploy.peerId, port: AGENT_PORTS.deploy })

    const connected = await connectToAllPeers(deploy)
    expect(deploy.dial).toHaveBeenCalledTimes(1)
  })
})

describe('network.js — publishMessage', () => {
  let network, agentRegistry

  beforeEach(async () => {
    vi.clearAllMocks()
    agentCounter = 0
    await configureCreateLibp2p()
    network = await import('../../agents/network.js')
    agentRegistry = network.agentRegistry
  })

  it('should send message to connected peers', async () => {
    const { createAgentNode, connectToAllPeers, publishMessage } = network
    const nodes = []
    for (const role of AGENT_NAMES) {
      nodes.push(await createAgentNode(role))
    }
    await connectToAllPeers(nodes[0])

    const result = await publishMessage(nodes[0], 'heartbeat', { msg: 'test' })
    expect(result.sent).toBeGreaterThan(0)
    expect(result.total).toBeGreaterThan(0)
  })

  it('should return 0 sent when no peers', async () => {
    const { publishMessage } = network
    agentRegistry.clear()
    const node = createMockLibp2pNode({ role: 'deploy' })
    node.getConnections.mockReturnValue([])
    const result = await publishMessage(node, 'test', {})
    expect(result).toEqual({ sent: 0, total: 0 })
  })
})

describe('network.js — subscribeToTopic', () => {
  let network

  beforeEach(async () => {
    vi.clearAllMocks()
    agentCounter = 0
    await configureCreateLibp2p()
    network = await import('../../agents/network.js')
  })

  it('should register a handler for a topic', async () => {
    const { subscribeToTopic } = network
    const node = createMockLibp2pNode({ role: 'deploy' })
    const handler = vi.fn()
    subscribeToTopic(node, 'heartbeat', handler)
  })

  it('should allow multiple handlers for the same topic', async () => {
    const { subscribeToTopic } = network
    const node = createMockLibp2pNode({ role: 'deploy' })
    subscribeToTopic(node, 'heartbeat', vi.fn())
    subscribeToTopic(node, 'heartbeat', vi.fn())
  })
})

describe('network.js — getNetworkStatus', () => {
  let network

  beforeEach(async () => {
    vi.clearAllMocks()
    agentCounter = 0
    await configureCreateLibp2p()
    network = await import('../../agents/network.js')
  })

  it('should report connected peer count', async () => {
    const { getNetworkStatus } = network
    const node = createMockLibp2pNode({ role: 'deploy', connections: [] })

    const status = getNetworkStatus(node)
    expect(status).toHaveProperty('role', 'deploy')
    expect(status).toHaveProperty('peers', 0)
    expect(status).toHaveProperty('list')
  })
})
