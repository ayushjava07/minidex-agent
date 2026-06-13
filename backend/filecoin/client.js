import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import * as dagCBOR from '@ipld/dag-cbor'
import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
import { createLogger } from '../../agents/logger.js'
import { loadFilecoinConfig } from './config.js'

const logger = createLogger('filecoin-client')

let _config = null
function getConfig() {
  if (!_config) _config = loadFilecoinConfig()
  return _config
}

export function resetConfigForTesting(customEnv) {
  _config = customEnv ? loadFilecoinConfig(customEnv) : null
}

async function withTimeout(promise, ms, label) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}

async function retryOperation(fn, attempts, delayMs, label) {
  let lastError
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      logger.warn(`${label} attempt ${i + 1}/${attempts} failed`, { error: error.message })
      if (i < attempts - 1) await new Promise(r => setTimeout(r, delayMs * (i + 1)))
    }
  }
  throw lastError
}

export async function generateCID(data) {
  const clean = typeof data === 'string' ? data : JSON.parse(JSON.stringify(data))
  const bytes = typeof clean === 'string' ? new TextEncoder().encode(clean) : dagCBOR.encode(clean)
  const hash = await sha256.digest(bytes)
  return CID.create(1, dagCBOR.code, hash).toString()
}

export async function verifyCID(data, expectedCid) {
  const actual = await generateCID(data)
  return actual === expectedCid
}

export async function uploadToStoracha(data, options = {}) {
  const config = getConfig()
  if (!config.storacha.enabled) {
    throw new Error('Storacha is not configured (STORACHA_TOKEN not set)')
  }

  const cid = await generateCID(data)
  const serialized = typeof data === 'string' ? data : JSON.stringify(data)
  const bytes = new TextEncoder().encode(serialized)
  const size = bytes.byteLength

  if (size > config.upload.maxSize) {
    throw new Error(`Upload size ${size} exceeds maximum ${config.upload.maxSize}`)
  }

  const uploadId = randomUUID()

  logger.info('storacha_upload_started', { cid, size, uploadId })

  const result = await retryOperation(async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), options.timeoutMs || config.upload.timeoutMs)

    try {
      const response = await fetch(`${config.storacha.endpoint}/api/v1/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.storacha.token}`,
          'Content-Type': 'application/json',
          'X-Upload-Id': uploadId
        },
        body: serialized,
        signal: controller.signal
      })

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(`Storacha upload failed (${response.status}): ${body.slice(0, 200)}`)
      }

      const result = await response.json()
      return result
    } finally {
      clearTimeout(timer)
    }
  }, config.upload.retryAttempts, config.upload.retryDelayMs, 'storacha-upload')

  logger.info('storacha_upload_completed', { cid, uploadId, filecoinCid: result?.cid })

  return { cid, uploadId, filecoinCid: result?.cid || cid, size, timestamp: Date.now() }
}

export async function retrieveFromStoracha(cid, options = {}) {
  const config = getConfig()
  if (!config.storacha.enabled) {
    throw new Error('Storacha is not configured')
  }

  logger.info('storacha_retrieve_started', { cid })

  const result = await retryOperation(async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), options.timeoutMs || config.upload.timeoutMs)

    try {
      const response = await fetch(`${config.storacha.endpoint}/api/v1/car/${cid}`, {
        headers: { 'Authorization': `Bearer ${config.storacha.token}` },
        signal: controller.signal
      })

      if (!response.ok) {
        throw new Error(`Storacha retrieve failed (${response.status})`)
      }

      const text = await response.text()
      return text
    } finally {
      clearTimeout(timer)
    }
  }, config.upload.retryAttempts, config.upload.retryDelayMs, 'storacha-retrieve')

  logger.info('storacha_retrieve_completed', { cid, size: result.length })

  return { cid, data: result, timestamp: Date.now() }
}

export async function proposeLotusDeal(cid, options = {}) {
  const config = getConfig()
  if (!config.lotus.enabled) {
    throw new Error('Lotus API is not configured (LOTUS_API_URL not set)')
  }

  const duration = options.minDuration || config.deals.minDuration
  const verified = options.verified !== undefined ? options.verified : config.deals.minVerified

  logger.info('lotus_deal_proposed', { cid, duration, verified })

  const dealId = `deal-${randomUUID().slice(0, 8)}-${Date.now()}`

  const result = await retryOperation(async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), options.timeoutMs || 60000)

    try {
      const response = await fetch(`${config.lotus.apiUrl}/api/v0/deal`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.lotus.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cid,
          duration,
          verified,
          dealId
        }),
        signal: controller.signal
      })

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(`Lotus deal proposal failed (${response.status}): ${body.slice(0, 200)}`)
      }

      return await response.json()
    } finally {
      clearTimeout(timer)
    }
  }, 3, 2000, 'lotus-deal')

  logger.info('lotus_deal_proposed_success', { dealId, cid, dealCid: result?.dealCid })

  return { dealId, cid, dealCid: result?.dealCid || null, duration, verified, timestamp: Date.now() }
}

export async function checkLotusDealStatus(dealCid) {
  const config = getConfig()
  if (!config.lotus.enabled) {
    throw new Error('Lotus API is not configured')
  }

  const response = await fetch(`${config.lotus.apiUrl}/api/v0/deal/${dealCid}/status`, {
    headers: { 'Authorization': `Bearer ${config.lotus.token}` }
  })

  if (!response.ok) {
    throw new Error(`Lotus deal status check failed (${response.status})`)
  }

  return response.json()
}

export async function verifyStorageProof(cid, filecoinCid) {
  const cidMatch = /^b[A-Za-z2-7]{58}$/.test(filecoinCid) || /^b[A-Za-z2-7]{58}$/.test(cid)

  if (!filecoinCid && !cidMatch) {
    return { valid: false, reason: 'No Filecoin CID available for verification' }
  }

  return { valid: true, cid, filecoinCid: filecoinCid || cid, verifiedAt: Date.now() }
}

export function getStorachaStatus(config = loadFilecoinConfig(process.env, { requireProvider: false })) {
  return {
    enabled: config.storacha.enabled,
    endpoint: config.storacha.enabled ? config.storacha.endpoint : null,
    space: config.storacha.enabled ? config.storacha.space : null
  }
}

export function getLotusStatus(config = loadFilecoinConfig(process.env, { requireProvider: false })) {
  return {
    enabled: config.lotus.enabled,
    endpoint: config.lotus.enabled ? config.lotus.apiUrl : null
  }
}
