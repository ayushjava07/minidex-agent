import { describe, expect, it } from 'vitest'
import { loadFilecoinConfig } from '../../backend/filecoin/config.js'

describe('Filecoin configuration', () => {
  it('requires a storage provider for storage operations', () => {
    expect(() => loadFilecoinConfig({})).toThrow('At least one of STORACHA_TOKEN or LOTUS_API_URL must be set')
  })

  it('allows provider-free configuration for API startup and status routes', () => {
    const config = loadFilecoinConfig({}, { requireProvider: false })

    expect(config.storacha.enabled).toBe(false)
    expect(config.lotus.enabled).toBe(false)
  })
})
