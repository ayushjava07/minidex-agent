import { expect } from 'vitest'

export function expectMeshComplete(status, expectedCount) {
  expect(status).toHaveProperty('role')
  expect(status).toHaveProperty('peers', expectedCount)
  expect(status).toHaveProperty('list')
  expect(Array.isArray(status.list)).toBe(true)
}

export function expectBroadcastResult(result, minSent, total) {
  expect(result).toHaveProperty('sent')
  expect(result).toHaveProperty('total', total)
  expect(result.sent).toBeGreaterThanOrEqual(minSent)
  expect(result.sent).toBeLessThanOrEqual(total)
}

export function expectValidCID(cid) {
  expect(cid).toBeDefined()
  expect(typeof cid).toBe('string')
  expect(cid.length).toBeGreaterThan(10)
}

export async function expectThrowsAsync(fn, msg) {
  try {
    await fn()
  } catch (err) {
    expect(err.message).toContain(msg)
    return
  }
  throw new Error('Expected function to throw')
}
