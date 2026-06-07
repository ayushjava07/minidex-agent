import { vi } from 'vitest'

vi.mock('libp2p', () => ({
  createLibp2p: vi.fn(),
}))

vi.mock('@libp2p/tcp', () => ({
  tcp: vi.fn(() => ({})),
}))

vi.mock('@chainsafe/libp2p-noise', () => ({
  noise: vi.fn(() => ({})),
}))

vi.mock('@chainsafe/libp2p-yamux', () => ({
  yamux: vi.fn(() => ({})),
}))

vi.mock('@libp2p/identify', () => ({
  identify: vi.fn(() => ({})),
}))

vi.mock('it-pipe', () => ({
  default: vi.fn(([_source], sink) => sink),
  pipe: vi.fn(),
}))

vi.mock('uint8arrays/to-string', () => ({
  default: (arr) => new TextDecoder().decode(arr),
  toString: (arr) => new TextDecoder().decode(arr),
}))

vi.mock('uint8arrays/from-string', () => ({
  default: (str) => new TextEncoder().encode(str),
  fromString: (str) => new TextEncoder().encode(str),
}))

vi.mock('@multiformats/multiaddr', () => {
  const multiaddr = vi.fn((addr) => {
    if (addr === undefined || addr === null) {
      throw new Error('multiaddr: value must be an integer')
    }
    if (typeof addr !== 'string') {
      throw new Error(`multiaddr: value must be an integer, got ${typeof addr}`)
    }
    return addr
  })
  return { multiaddr }
})
