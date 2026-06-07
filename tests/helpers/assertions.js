import { expect } from 'vitest'

export function expectMeshComplete(statuses, expectedCount = 4) {
  for (const [role, count] of Object.entries(statuses)) {
    expect(count).toBe(expectedCount)
  }
}

export function expectBroadcastResult(result, expectedSent, expectedTotal) {
  expect(result).toHaveProperty('sent', expectedSent)
  expect(result).toHaveProperty('total', expectedTotal)
}

export function expectValidCID(cid) {
  expect(cid).toBeDefined()
  expect(typeof cid).toBe('string')
  expect(cid.length).toBeGreaterThan(30)
}

export async function expectThrowsAsync(fn, errorPattern) {
  let thrown = false
  try {
    await fn()
  } catch (err) {
    thrown = true
    if (errorPattern instanceof RegExp) {
      expect(err.message).toMatch(errorPattern)
    } else if (typeof errorPattern === 'string') {
      expect(err.message).toContain(errorPattern)
    }
  }
  expect(thrown).toBe(true)
}
