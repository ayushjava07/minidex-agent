import { vi } from 'vitest'
import { makeMockPeerId } from './fixtures.js'

export function createMockLibp2pNode(opts = {}) {
  const peerId = opts.peerId || makeMockPeerId(opts.role || 'deploy')

  const connections = opts.connections !== undefined
    ? [...opts.connections]
    : []

  const mockNode = {
    peerId,
    role: opts.role || 'deploy',
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    handle: vi.fn(),
    dial: vi.fn().mockImplementation(async (target) => {
      const conn = createMockConnection({ peerId: target })
      connections.push(conn)
      return conn
    }),
    getConnections: vi.fn().mockReturnValue(connections),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    peerStore: {
      merge: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn(),
      get: vi.fn(),
    },
  }

  return mockNode
}

export function createMockConnection(opts = {}) {
  const id = opts.id || 'mock-conn-' + Date.now()
  const peerId = opts.peerId || { toString: () => 'MockPeer-' + Date.now() }
  if (!peerId.equals) {
    peerId.equals = (other) => other && other.toString() === peerId.toString()
  }
  return {
    id,
    remoteAddr: opts.remoteAddr || '/ip4/127.0.0.1/tcp/0',
    remotePeer: peerId,
    timeline: {
      open: Date.now() - 1000,
      close: undefined,
    },
    newStream: vi.fn().mockResolvedValue(createMockStream()),
    close: vi.fn().mockResolvedValue(undefined),
  }
}

export function createMockStream(opts = {}) {
  const chunks = opts.chunks || []
  const data = opts.data || ''

  const stream = {
    id: opts.id || 'mock-stream-' + Date.now(),
    stat: {
      direction: opts.direction || 'outbound',
      timeline: {
        open: Date.now() - 500,
        close: undefined,
      },
    },
    close: vi.fn().mockResolvedValue(undefined),
    closeRead: vi.fn(),
    closeWrite: vi.fn(),
    abort: vi.fn(),
    sendData: vi.fn(),
    source: (async function* () {
      for (const chunk of chunks) {
        yield chunk
      }
    })(),
    sink: vi.fn(),
  }

  return stream
}
