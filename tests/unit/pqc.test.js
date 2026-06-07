import { describe, it, expect, vi, beforeEach } from 'vitest'

const virtualFs = vi.hoisted(() => {
  const store = {}
  return {
    store,
    existsSync: (p) => p in store,
    readFileSync: (p, enc) => {
      if (!(p in store)) throw new Error(`ENOENT: ${p}`)
      return enc === 'utf8' || enc === 'utf-8' ? store[p] : Buffer.from(store[p] || '')
    },
    writeFileSync: (p, data) => {
      store[p] = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
    },
    mkdirSync: () => {},
    readdirSync: () => [],
  }
})

vi.mock('fs', () => ({
  existsSync: virtualFs.existsSync,
  readFileSync: virtualFs.readFileSync,
  writeFileSync: virtualFs.writeFileSync,
  mkdirSync: virtualFs.mkdirSync,
  readdirSync: virtualFs.readdirSync,
  default: {
    existsSync: virtualFs.existsSync,
    readFileSync: virtualFs.readFileSync,
    writeFileSync: virtualFs.writeFileSync,
    mkdirSync: virtualFs.mkdirSync,
    readdirSync: virtualFs.readdirSync,
  },
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

describe('pqc.js', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(virtualFs.store).forEach(k => delete virtualFs.store[k])
  })

  describe('generateKeys', () => {
    it('should generate and save keys for a role', async () => {
      const { generateKeys } = await import('../../agents/pqc.js')
      const keys = generateKeys('deploy')
      expect(keys).toBeDefined()
      expect(keys.publicKey).toBeDefined()
      expect(keys.secretKey).toBeDefined()
    })

    it('should create public-keys.json with the role', async () => {
      const { generateKeys } = await import('../../agents/pqc.js')
      generateKeys('deploy')
      const pubKeyPath = Object.keys(virtualFs.store).find(k => k.includes('public-keys'))
      expect(pubKeyPath).toBeDefined()
      if (pubKeyPath) {
        const data = JSON.parse(virtualFs.store[pubKeyPath])
        expect(data.deploy).toBeDefined()
      }
    })

    it('should return existing keys if already generated', async () => {
      const { generateKeys } = await import('../../agents/pqc.js')
      generateKeys('monitor')
      const keys2 = generateKeys('monitor')
      expect(keys2).toBeDefined()
      expect(keys2.publicKey).toBeDefined()
    })
  })

  describe('encryptMessage', () => {
    it('should return null when no public key exists for target', async () => {
      const { encryptMessage } = await import('../../agents/pqc.js')
      const result = encryptMessage('nonexistent-role', 'hello')
      expect(result).toBeNull()
    })

    it('should encrypt a message for a known role', async () => {
      const { generateKeys, encryptMessage } = await import('../../agents/pqc.js')
      generateKeys('deploy')
      generateKeys('monitor')
      const result = encryptMessage('monitor', 'secret message')
      expect(result).toBeDefined()
      expect(result).not.toBeNull()
      if (result) {
        expect(result).toHaveProperty('encryptedMessage')
        expect(result).toHaveProperty('iv')
        expect(result).toHaveProperty('targetRole', 'monitor')
      }
    })
  })

  describe('decryptMessage', () => {
    it('should throw when secret key is missing', async () => {
      const { decryptMessage } = await import('../../agents/pqc.js')
      expect(() => decryptMessage('nonexistent', 'cipher', 'enc', 'iv')).toThrow('Secret key not found')
    })
  })

  describe('getMyPublicKey', () => {
    it('should return null when no keys exist', async () => {
      const { getMyPublicKey } = await import('../../agents/pqc.js')
      const key = getMyPublicKey('nonexistent')
      expect(key).toBeNull()
    })

    it('should return hex public key for existing role', async () => {
      const { generateKeys, getMyPublicKey } = await import('../../agents/pqc.js')
      generateKeys('analytics')
      const key = getMyPublicKey('analytics')
      expect(key).toBeDefined()
      expect(typeof key).toBe('string')
    })
  })
})
