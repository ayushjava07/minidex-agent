import { describe, it, expect, vi } from 'vitest'

vi.mock('multiformats/cid', () => ({
  CID: {
    create: vi.fn((_version, _code, hash) => ({
      toString: () => 'bafyreihtest' + Array.from(new Uint8Array(hash.digest)).slice(0, 10).map(b => b.toString(16).padStart(2, '0')).join(''),
    })),
  },
}))

vi.mock('multiformats/codecs/json', () => ({
  code: 0x0200,
  encode: (data) => new TextEncoder().encode(JSON.stringify(data)),
  decode: (bytes) => JSON.parse(new TextDecoder().decode(bytes)),
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

describe('cid-helper.js', () => {
  it('should generate a CID from data', async () => {
    const { generateCID } = await import('../../agents/cid-helper.js')
    const cid = await generateCID({ test: 'data' })
    expect(cid).toBeDefined()
    expect(typeof cid).toBe('string')
    expect(cid.startsWith('bafyreih')).toBe(true)
  })

  it('should generate different CIDs for different data', async () => {
    const { generateCID } = await import('../../agents/cid-helper.js')
    const cid1 = await generateCID({ a: 1 })
    const cid2 = await generateCID({ a: 2 })
    expect(cid1).not.toBe(cid2)
  })
})
