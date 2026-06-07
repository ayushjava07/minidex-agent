export const AGENT_ROLES = ['deploy', 'monitor', 'report', 'liquidity', 'analytics']

export const AGENT_PORTS = {
  deploy: 4001,
  monitor: 4002,
  report: 4003,
  liquidity: 4004,
  analytics: 4005,
}

export const PROTOCOL = '/atos/1.0.0'

export const MOCK_PEER_ID = '12D3KooWMockPeerIdForTesting'

export function makeMockPeerId(role) {
  const hex = Buffer.from(role).toString('hex').padEnd(32, '0')
  return `12D3KooW${hex.slice(0, 16)}`
}

export const VALID_TASK_DATA = {
  agent: 'deploy',
  workflow: 'deploy-agent-startup',
  status: 'in-progress',
  explanation: 'Test task',
  inputs: { role: 'deploy', network: 'test' },
}

export const INVALID_TASK_DATA_MISSING_AGENT = {
  workflow: 'test',
  status: 'in-progress',
}

export const INVALID_TASK_DATA_MISSING_WORKFLOW = {
  agent: 'deploy',
  status: 'in-progress',
}

export const VALID_EXEC_DATA = {
  taskCID: 'bafyreihtest',
  event: 'task_started',
  agent: 'deploy',
  outcome: 'success',
}

export const INVALID_EXEC_DATA_MISSING_TASKCID = {
  event: 'task_started',
  agent: 'deploy',
}

export const BROADCAST_MESSAGE = {
  topic: 'heartbeat',
  data: { from: 'deploy', msg: 'test message', ts: Date.now() },
}

export const TEST_NODE_METHODS = [
  'start',
  'stop',
  'handle',
  'dial',
  'getConnections',
  'addEventListener',
  'peerStore',
]
