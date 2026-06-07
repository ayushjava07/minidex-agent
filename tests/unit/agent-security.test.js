import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('retry.js — loadRetryConfig', () => {
  it('should return defaults when no env set', async () => {
    const { loadRetryConfig } = await import('../../agents/retry.js')
    const config = loadRetryConfig({})
    expect(config).toEqual({ maxAttempts: 3, initialDelayMs: 200, maxDelayMs: 2000 })
  })

  it('should read values from env', async () => {
    const { loadRetryConfig } = await import('../../agents/retry.js')
    const config = loadRetryConfig({
      NETWORK_RETRY_ATTEMPTS: '5',
      NETWORK_RETRY_DELAY_MS: '100',
      NETWORK_RETRY_MAX_DELAY_MS: '1000',
    })
    expect(config).toEqual({ maxAttempts: 5, initialDelayMs: 100, maxDelayMs: 1000 })
  })

  it('should throw on invalid maxAttempts', async () => {
    const { loadRetryConfig } = await import('../../agents/retry.js')
    expect(() => loadRetryConfig({ NETWORK_RETRY_ATTEMPTS: '0' })).toThrow()
    expect(() => loadRetryConfig({ NETWORK_RETRY_ATTEMPTS: '-1' })).toThrow()
  })
})

describe('retry.js — withRetry', () => {
  it('should succeed on first attempt', async () => {
    const { withRetry } = await import('../../agents/retry.js')
    const op = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(op, { maxAttempts: 3 })
    expect(result).toBe('ok')
    expect(op).toHaveBeenCalledTimes(1)
  })

  it('should retry on failure and eventually succeed', async () => {
    const { withRetry } = await import('../../agents/retry.js')
    const op = vi.fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockResolvedValueOnce('recovered')
    const sleeps = []
    const result = await withRetry(op, {
      maxAttempts: 5,
      initialDelayMs: 10,
      maxDelayMs: 100,
      sleep: (ms) => { sleeps.push(ms); return Promise.resolve() },
    })
    expect(result).toBe('recovered')
    expect(op).toHaveBeenCalledTimes(3)
  })

  it('should exhaust all attempts and throw last error', async () => {
    const { withRetry } = await import('../../agents/retry.js')
    const err = new Error('final error')
    const op = vi.fn().mockRejectedValue(err)
    const sleeps = []
    await expect(withRetry(op, {
      maxAttempts: 3,
      initialDelayMs: 10,
      maxDelayMs: 100,
      sleep: (ms) => { sleeps.push(ms); return Promise.resolve() },
    })).rejects.toThrow('final error')
    expect(op).toHaveBeenCalledTimes(3)
  })

  it('should cap exponential backoff at maxDelayMs', async () => {
    const { withRetry } = await import('../../agents/retry.js')
    const op = vi.fn().mockRejectedValue(new Error('fail'))
    const sleeps = []
    await expect(withRetry(op, {
      maxAttempts: 5,
      initialDelayMs: 50,
      maxDelayMs: 200,
      sleep: (ms) => { sleeps.push(ms); return Promise.resolve() },
    })).rejects.toThrow()
    expect(Math.max(...sleeps)).toBeLessThanOrEqual(200)
    expect(sleeps).toEqual([50, 100, 200, 200])
  })

  it('should call onRetry callback on each failure', async () => {
    const { withRetry } = await import('../../agents/retry.js')
    const op = vi.fn().mockRejectedValue(new Error('fail'))
    const onRetry = vi.fn()
    await expect(withRetry(op, {
      maxAttempts: 2,
      initialDelayMs: 10,
      maxDelayMs: 100,
      sleep: () => Promise.resolve(),
      onRetry,
    })).rejects.toThrow()
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onRetry.mock.calls[0][0]).toHaveProperty('attempt', 1)
    expect(onRetry.mock.calls[0][0]).toHaveProperty('delayMs')
    expect(onRetry.mock.calls[0][0]).toHaveProperty('error')
  })
})

describe('message-schema.js — validateMessageEnvelope', () => {
  it('should accept a valid message envelope', async () => {
    const { validateMessageEnvelope } = await import('../../agents/message-schema.js')
    const msg = { topic: 'heartbeat', data: { foo: 'bar' }, from: 'deploy', ts: Date.now() }
    const result = validateMessageEnvelope(msg)
    expect(result).toEqual(msg)
  })

  it('should reject message with invalid topic', async () => {
    const { validateMessageEnvelope } = await import('../../agents/message-schema.js')
    expect(() => validateMessageEnvelope({ topic: '../admin', data: {}, from: 'deploy', ts: 1 }))
      .toThrow('topic')
    expect(() => validateMessageEnvelope({ topic: '', data: {}, from: 'deploy', ts: 1 }))
      .toThrow('topic')
    expect(() => validateMessageEnvelope({ topic: 'UPPERCASE', data: {}, from: 'deploy', ts: 1 }))
      .toThrow('topic')
  })

  it('should reject message with invalid from field', async () => {
    const { validateMessageEnvelope } = await import('../../agents/message-schema.js')
    expect(() => validateMessageEnvelope({ topic: 'test', data: {}, from: '', ts: 1 }))
      .toThrow('sender has an invalid format')
  })

  it('should reject message with non-object data', async () => {
    const { validateMessageEnvelope } = await import('../../agents/message-schema.js')
    expect(() => validateMessageEnvelope({ topic: 'test', data: 'string-not-object', from: 'deploy', ts: 1 }))
      .toThrow('data')
  })

  it('should reject deeply nested data', async () => {
    const { validateMessageEnvelope } = await import('../../agents/message-schema.js')
    let deep = {}
    let cur = deep
    for (let i = 0; i < 20; i++) { cur.x = {}; cur = cur.x }
    expect(() => validateMessageEnvelope({ topic: 'test', data: deep, from: 'deploy', ts: 1 }))
      .toThrow('depth')
  })

  it('should reject prototype pollution payload', async () => {
    const { validateMessageEnvelope } = await import('../../agents/message-schema.js')
    expect(() => validateMessageEnvelope({ topic: 'test', data: { __proto__: { admin: true } }, from: 'deploy', ts: 1 }))
      .toThrow()
  })
})

describe('message-schema.js — parseMessage', () => {
  it('should parse a valid message string', async () => {
    const { parseMessage } = await import('../../agents/message-schema.js')
    const raw = JSON.stringify({ topic: 'test', data: { a: 1 }, from: 'deploy', ts: 1000 })
    const result = parseMessage(raw)
    expect(result).toHaveProperty('topic', 'test')
    expect(result).toHaveProperty('data', { a: 1 })
  })

  it('should reject non-JSON input', async () => {
    const { parseMessage } = await import('../../agents/message-schema.js')
    expect(() => parseMessage('not-json')).toThrow()
  })

  it('should reject oversized messages', async () => {
    const { parseMessage } = await import('../../agents/message-schema.js')
    const raw = JSON.stringify({ topic: 'test', data: { x: 'a'.repeat(500) }, from: 'deploy', ts: 1 })
    expect(() => parseMessage(raw, { maxMessageBytes: 10 })).toThrow('exceeds maximum size')
  })

  it('should pass messages within size limit', async () => {
    const { parseMessage } = await import('../../agents/message-schema.js')
    const raw = JSON.stringify({ topic: 'test', data: { a: 1 }, from: 'deploy', ts: 1 })
    const result = parseMessage(raw, { maxMessageBytes: 10000 })
    expect(result).toHaveProperty('topic', 'test')
  })
})

describe('message-auth.js — loadMessageAuthConfig', () => {
  it('should throw if secret is missing', async () => {
    const { loadMessageAuthConfig } = await import('../../agents/message-auth.js')
    expect(() => loadMessageAuthConfig({})).toThrow('NETWORK_AUTH_SECRET')
  })

  it('should throw if secret is too short', async () => {
    const { loadMessageAuthConfig } = await import('../../agents/message-auth.js')
    expect(() => loadMessageAuthConfig({ NETWORK_AUTH_SECRET: 'short' })).toThrow('NETWORK_AUTH_SECRET')
  })

  it('should return config for valid secret', async () => {
    const { loadMessageAuthConfig } = await import('../../agents/message-auth.js')
    const config = loadMessageAuthConfig({ NETWORK_AUTH_SECRET: 'a'.repeat(32) })
    expect(config).toHaveProperty('secret')
    expect(config).toHaveProperty('maxClockSkewMs')
    expect(config).toHaveProperty('replayTtlMs')
  })
})

describe('message-auth.js — createReplayProtector', () => {
  it('should reject replayed message id', async () => {
    const { createReplayProtector } = await import('../../agents/message-auth.js')
    const { assertFresh } = createReplayProtector({ maxClockSkewMs: 60000, replayTtlMs: 300000 })
    const msg = { id: 'abc-123', ts: Date.now() }
    assertFresh(msg)
    expect(() => assertFresh(msg)).toThrow('Replay attack detected')
  })

  it('should reject stale timestamp', async () => {
    const { createReplayProtector } = await import('../../agents/message-auth.js')
    const { assertFresh } = createReplayProtector({ maxClockSkewMs: 1000, replayTtlMs: 300000 })
    expect(() => assertFresh({ id: 'msg-1', ts: Date.now() - 2000 })).toThrow('clock skew')
  })
})

describe('message-auth.js — verifyMessageAuthentication', () => {
  it('should reject missing auth field', async () => {
    const { verifyMessageAuthentication } = await import('../../agents/message-auth.js')
    expect(() => verifyMessageAuthentication({ topic: 'test', data: {} }, 'secret'))
      .toThrow('auth')
  })

  it('should reject invalid auth format', async () => {
    const { verifyMessageAuthentication } = await import('../../agents/message-auth.js')
    expect(() => verifyMessageAuthentication({ topic: 'test', data: {}, auth: 'not-hex' }, 'secret'))
      .toThrow('auth')
  })
})
