import { createLogger } from './logger.js'
import { storeData, retrieveData, verifyData } from '../backend/filecoin/store.js'
import { generateCID } from '../backend/filecoin/client.js'
import { loadFilecoinConfig } from '../backend/filecoin/config.js'
import { logTask, logExecution } from './ipld-logger.js'

const logger = createLogger('filecoin-bridge')

const pendingUploads = new Map()
const completedUploads = new Map()

export async function backupTaskToFilecoin(taskCID, taskData, options = {}) {
  const config = loadFilecoinConfig()
  const hasBackend = config.storacha.enabled || config.lotus.enabled

  if (!hasBackend) {
    logger.info('backup_skipped_no_backend', { taskCID })
    return { skipped: true, reason: 'No Filecoin backend configured' }
  }

  const dataCid = await generateCID(taskData)
  const cacheKey = `${taskCID}:${dataCid}`

  if (completedUploads.has(cacheKey)) {
    logger.info('backup_cache_hit', { taskCID, dataCid })
    return completedUploads.get(cacheKey)
  }

  pendingUploads.set(taskCID, { status: 'uploading', dataCid, startedAt: Date.now() })

  logger.info('backup_started', { taskCID, dataCid, size: JSON.stringify(taskData).length })

  try {
    const result = await storeData(taskData, options)

    pendingUploads.delete(taskCID)
    completedUploads.set(cacheKey, result)

    await logExecution({
      peerId: options.peerId || 'filecoin-bridge',
      taskCID,
      event: 'filecoin_backup',
      agent: 'filecoin-bridge',
      outcome: 'success',
      txHash: result.cid
    })

    logger.info('backup_completed', { taskCID, cid: result.cid, filecoinCid: result.storacha?.filecoinCid || 'N/A' })
    return result
  } catch (error) {
    pendingUploads.set(taskCID, { status: 'failed', dataCid, error: error.message, failedAt: Date.now() })

    await logExecution({
      peerId: options.peerId || 'filecoin-bridge',
      taskCID,
      event: 'filecoin_backup_failed',
      agent: 'filecoin-bridge',
      outcome: 'failed'
    })

    logger.error('backup_failed', { taskCID, error: error.message })
    throw error
  }
}

export async function retrieveTaskFromFilecoin(cid) {
  logger.info('retrieve_task_started', { cid })

  try {
    const result = await retrieveData(cid)
    logger.info('retrieve_task_completed', { cid, size: result.size })
    return result
  } catch (error) {
    logger.error('retrieve_task_failed', { cid, error: error.message })
    throw error
  }
}

export async function verifyTaskBackup(cid, filecoinCid) {
  logger.info('verify_task_started', { cid })
  return verifyData(cid, filecoinCid)
}

export function getUploadQueue() {
  return {
    pending: [...pendingUploads.entries()].map(([taskCID, info]) => ({
      taskCID,
      ...info
    })),
    completed: completedUploads.size
  }
}

export function createAutoBackupHandler(node, options = {}) {
  const { subscribeToTopic } = options.imports || {}
  if (!subscribeToTopic || !node) return null

  const autoBackup = options.autoBackup !== false
  const backupTopics = options.backupTopics || ['task-completed', 'agent-report', 'audit-event']

  if (!autoBackup) return null

  const unsubscribers = backupTopics.map(topic => {
    try {
      return subscribeToTopic(node, topic, async (data) => {
        const taskCID = data?.taskCID || data?.cid
        if (!taskCID) return

        try {
          await backupTaskToFilecoin(taskCID, data, options)
        } catch {
          logger.warn('auto_backup_failed', { topic, taskCID })
        }
      })
    } catch (error) {
      logger.warn('auto_backup_subscribe_failed', { topic, error: error.message })
      return null
    }
  }).filter(Boolean)

  return function stopAutoBackup() {
    unsubscribers.forEach(fn => fn())
    logger.info('auto_backup_stopped')
  }
}

export { loadFilecoinConfig, generateCID }
