import { createLogger } from '../../agents/logger.js'
import { generateCID, uploadToStoracha, retrieveFromStoracha, proposeLotusDeal, verifyStorageProof } from './client.js'
import { filecoinMetrics } from './metrics.js'
import { loadFilecoinConfig } from './config.js'

const logger = createLogger('filecoin-store')

const uploadCache = new Map()
const retrieveCache = new Map()
let uploadCount = 0n
let retrieveCount = 0n

export function resetCache() {
  uploadCache.clear()
  retrieveCache.clear()
  uploadCount = 0n
  retrieveCount = 0n
}

export async function storeData(data, options = {}) {
  const config = loadFilecoinConfig()
  const start = Date.now()
  const cid = await generateCID(data)

  const cached = uploadCache.get(cid)
  if (cached) {
    logger.info('store_cache_hit', { cid })
    return { ...cached, cached: true }
  }

  const serialized = typeof data === 'string' ? data : JSON.stringify(data)
  const size = new TextEncoder().encode(serialized).byteLength

  let storachaResult = null
  let lotusResult = null
  let status = 'success'

  try {
    if (config.storacha.enabled) {
      storachaResult = await uploadToStoracha(data, options)
      filecoinMetrics.uploadBytes.inc({ backend: 'storacha' }, size)
    }
  } catch (error) {
    status = 'storacha_failed'
    logger.error('store_storacha_failed', { cid, error: error.message })
    if (!config.lotus.enabled) throw error
  }

  try {
    if (config.lotus.enabled) {
      const dealCid = storachaResult?.filecoinCid || cid
      lotusResult = await proposeLotusDeal(dealCid, options)
    }
  } catch (error) {
    if (status === 'success') status = 'lotus_failed'
    logger.error('store_lotus_failed', { cid, error: error.message })
  }

  const duration = (Date.now() - start) / 1000
  filecoinMetrics.uploadCount.inc({ backend: storachaResult ? 'storacha' : 'lotus', status })
  filecoinMetrics.uploadDuration.observe({ backend: storachaResult ? 'storacha' : 'lotus' }, duration)

  if (storachaResult) {
    filecoinMetrics.storageSize.inc({ backend: 'storacha' }, size)
  }

  const result = {
    cid,
    size,
    storacha: storachaResult,
    lotus: lotusResult,
    status,
    duration,
    timestamp: Date.now()
  }

  uploadCache.set(cid, result)
  uploadCount++

  logger.info('store_completed', { cid, status, size, durationMs: duration * 1000 })
  return result
}

export async function retrieveData(cid, options = {}) {
  const config = loadFilecoinConfig()
  const start = Date.now()

  const cached = retrieveCache.get(cid)
  if (cached) {
    logger.info('retrieve_cache_hit', { cid })
    return { ...cached, cached: true }
  }

  let storachaResult = null
  let status = 'success'

  try {
    if (config.storacha.enabled) {
      storachaResult = await retrieveFromStoracha(cid, options)
      filecoinMetrics.retrieveBytes.inc({ backend: 'storacha' }, storachaResult.data.length)
    } else {
      throw new Error('No storage backend is available for retrieval')
    }
  } catch (error) {
    status = 'failed'
    logger.error('retrieve_failed', { cid, error: error.message })
    throw error
  }

  const duration = (Date.now() - start) / 1000
  filecoinMetrics.retrieveCount.inc({ backend: 'storacha', status })
  filecoinMetrics.retrieveDuration.observe({ backend: 'storacha' }, duration)

  const result = {
    cid,
    data: storachaResult.data,
    size: storachaResult.data.length,
    status,
    duration,
    timestamp: Date.now()
  }

  retrieveCache.set(cid, result)
  retrieveCount++

  logger.info('retrieve_completed', { cid, status, size: result.size, durationMs: duration * 1000 })
  return result
}

export async function verifyData(cid, filecoinCid) {
  const start = Date.now()
  const result = await verifyStorageProof(cid, filecoinCid)
  result.duration = (Date.now() - start) / 1000
  result.timestamp = Date.now()

  logger.info('verify_completed', { cid, valid: result.valid, durationMs: result.duration * 1000 })
  return result
}

export function getStoreStats() {
  return {
    uploadCacheSize: uploadCache.size,
    retrieveCacheSize: retrieveCache.size,
    uploadCount: uploadCount.toString(),
    retrieveCount: retrieveCount.toString()
  }
}
