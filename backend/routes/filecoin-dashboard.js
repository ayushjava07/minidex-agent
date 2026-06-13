import { Router } from 'express'
import { createLogger } from '../../agents/logger.js'
import { retrieveData, storeData } from '../filecoin/store.js'
import {
  addEvent,
  addSSEClient,
  addUpload,
  getAnalytics,
  getRecentEvents,
  getReports,
  getStats,
  getUploadByCid,
  getUploads
} from '../filecoin/upload-store.js'

const logger = createLogger('filecoin-dashboard-routes')

export function createFilecoinDashboardRouter() {
  const router = Router()

  router.post('/upload', async (req, res) => {
    try {
      const { data, sourceAgent, type } = req.body
      if (!data) return res.status(400).json({ success: false, error: 'data is required' })

      const result = await storeData(data, req.options)
      const entry = addUpload({
        cid: result.cid,
        size: result.size,
        sourceAgent: sourceAgent || 'manual',
        type: type || 'manual-upload',
        status: result.status,
        verified: result.status === 'success',
        storacha: result.storacha,
        lotus: result.lotus,
        duration: result.duration
      })

      addEvent({ type: 'upload', cid: result.cid, agent: sourceAgent || 'manual', status: result.status })

      res.json({
        success: true,
        cid: result.cid,
        timestamp: entry.createdAt,
        size: result.size,
        sourceAgent: sourceAgent || 'manual',
        verified: result.status === 'success',
        storeResult: result,
        entry
      })
    } catch (error) {
      logger.error('api_upload_failed', { error: error.message })
      const code = error.code === 'INVALID_FILECOIN_CONFIG' ? 503 : 500
      res.status(code).json({ success: false, error: error.message })
    }
  })

  router.get('/cid/:cid', async (req, res) => {
    try {
      const record = getUploadByCid(req.params.cid)
      if (!record) return res.status(404).json({ success: false, error: 'CID not found' })

      const result = await retrieveData(req.params.cid)
      res.json({
        success: true,
        cid: req.params.cid,
        data: result.data,
        size: result.size,
        timestamp: record.createdAt,
        sourceAgent: record.sourceAgent,
        verified: record.verified,
        record
      })
    } catch (error) {
      logger.error('api_cid_retrieve_failed', { error: error.message })
      res.status(500).json({ success: false, error: error.message })
    }
  })

  router.get('/uploads', (req, res) => {
    const { page = '1', limit = '20', sort = 'createdAt', order = 'desc', agent, status, search } = req.query
    const result = getUploads({ page: Number(page), limit: Number(limit), sort, order, agent, status, search })
    res.json({ success: true, ...result })
  })

  router.get('/stats', (req, res) => {
    res.json({ success: true, ...getStats() })
  })

  router.get('/analytics', (req, res) => {
    const analytics = getAnalytics({ days: Number(req.query.days || 30) })
    res.json({ success: true, ...analytics })
  })

  router.get('/reports', (req, res) => {
    const reports = getReports({ page: Number(req.query.page || 1), limit: Number(req.query.limit || 20) })
    res.json({ success: true, ...reports })
  })

  router.get('/activity', (req, res) => {
    res.json({ success: true, events: getRecentEvents({ limit: Number(req.query.limit || 50) }) })
  })

  router.get('/feed', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    })
    res.write('data: {"type":"connected"}\n\n')
    addSSEClient(res)
  })

  return router
}
