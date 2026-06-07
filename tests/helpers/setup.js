import { vi } from 'vitest'

export function setupLibp2pMocks() {
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
}

export function setupIPLDMocks() {
  vi.mock('@ipld/dag-cbor', () => ({
    encode: vi.fn((data) => Buffer.from(JSON.stringify(data))),
    decode: vi.fn((bytes) => JSON.parse(Buffer.from(bytes).toString())),
    code: 0x0129,
  }))

  vi.mock('multiformats/cid', () => ({
    CID: {
      create: vi.fn((version, code, hash) => ({
        toString: () => 'bafyreihtest' + Array.from(new Uint8Array(hash.digest)).slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join(''),
      })),
    },
  }))

  vi.mock('multiformats/hashes/sha2', () => ({
    sha256: {
      digest: vi.fn(async (bytes) => {
        const b = bytes instanceof Uint8Array ? Buffer.from(bytes) : Buffer.from(bytes)
        const hash = await crypto.subtle.digest('SHA-256', b)
        return {
          code: 0x12,
          size: 32,
          digest: new Uint8Array(hash),
        }
      }),
    },
  }))
}

export function setupPQCMocks() {
  vi.mock('fs', () => ({
    default: {
      existsSync: vi.fn(),
      mkdirSync: vi.fn(),
      chmodSync: vi.fn(),
      writeFileSync: vi.fn(),
      readFileSync: vi.fn(),
      readdirSync: vi.fn(),
    },
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    chmodSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(),
    readdirSync: vi.fn(),
  }))

  vi.mock('@noble/post-quantum/ml-kem.js', () => ({
    ml_kem768: {
      keygen: vi.fn(() => ({
        publicKey: new Uint8Array(1184).fill(1),
        secretKey: new Uint8Array(2400).fill(2),
      })),
      encapsulate: vi.fn(() => ({
        cipherText: new Uint8Array(1088).fill(3),
        sharedSecret: new Uint8Array(32).fill(42),
      })),
      decapsulate: vi.fn(() => new Uint8Array(32).fill(42)),
    },
  }))
}

export function setupEthersMocks() {
  vi.mock('ethers', () => {
    const MockProvider = vi.fn(() => ({
      getBlockNumber: vi.fn().mockResolvedValue(123456),
      getBalance: vi.fn().mockResolvedValue(BigInt(1000000)),
    }))

    const MockContract = vi.fn(() => ({
      getReserves: vi.fn().mockResolvedValue([BigInt(1000), BigInt(2000)]),
      queryFilter: vi.fn().mockResolvedValue([]),
      filters: {},
    }))

    return {
      ethers: {
        JsonRpcProvider: MockProvider,
        Contract: MockContract,
        parseEther: (val) => BigInt(Math.floor(parseFloat(val) * 1e18)),
        formatEther: (val) => (Number(val) / 1e18).toString(),
        Wallet: vi.fn(() => ({
          connect: vi.fn(),
          getAddress: vi.fn().mockResolvedValue('0xmock'),
        })),
      },
    }
  })
}
