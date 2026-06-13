import express, { Router } from 'express'
import { createLogger } from '../../agents/logger.js'
import { storeData, retrieveData, verifyData, getStoreStats } from './store.js'
import { generateCID, getStorachaStatus, getLotusStatus } from './client.js'
import { loadFilecoinConfig } from './config.js'
import { createFilecoinRateLimiter, createFilecoinAuthMiddleware, createFilecoinValidationMiddleware } from './middleware.js'

const logger = createLogger('filecoin-routes')

export function createFilecoinRouter(options = {}) {
  const config = loadFilecoinConfig(process.env, { requireProvider: false })
  const router = Router()

  const auth = options.auth ?? createFilecoinAuthMiddleware(options.apiToken)
  const rateLimit = options.rateLimit ?? createFilecoinRateLimiter(config.api.rateLimitRps)
  const validation = options.validation ?? createFilecoinValidationMiddleware()

  router.use(auth)
  router.use(rateLimit)
  router.use(validation)

  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      storacha: getStorachaStatus(config),
      lotus: getLotusStatus(config),
      timestamp: Date.now()
    })
  })

  router.post('/store', async (req, res) => {
    try {
      const result = await storeData(req.body, req.options)
      res.status(201).json(result)
    } catch (error) {
      logger.error('route_store_failed', { error: error.message })
      const code = error.code === 'INVALID_FILECOIN_CONFIG' ? 503 : 500
      res.status(code).json({ error: error.message })
    }
  })

  router.post('/retrieve/:cid', async (req, res) => {
    try {
      const result = await retrieveData(req.params.cid, req.options)
      res.json(result)
    } catch (error) {
      logger.error('route_retrieve_failed', { cid: req.params.cid, error: error.message })
      res.status(404).json({ error: error.message })
    }
  })

  router.post('/verify/:cid', async (req, res) => {
    try {
      const result = await verifyData(req.params.cid, req.body?.filecoinCid)
      res.json(result)
    } catch (error) {
      logger.error('route_verify_failed', { cid: req.params.cid, error: error.message })
      res.status(500).json({ error: error.message })
    }
  })

  router.get('/stats', (req, res) => {
    res.json(getStoreStats())
  })

  router.get('/status', (req, res) => {
    res.json({
      storacha: getStorachaStatus(config),
      lotus: getLotusStatus(config),
      config: {
        api: config.api,
        upload: config.upload,
        deals: config.deals
      }
    })
  })

  router.post('/cid', async (req, res) => {
    try {
      const cid = await generateCID(req.body)
      res.json({ cid })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  return router
}

export function getFilecoinApiServer(options = {}) {
  const app = express()
  app.use(express.json({ limit: '200mb' }))
  app.use('/api/v1/filecoin', createFilecoinRouter(options))
  return app
}

export async function startFilecoinApiServer(options = {}) {
  const config = loadFilecoinConfig(process.env, { requireProvider: false })
  const app = getFilecoinApiServer(options)
  const port = options.port ?? config.api.port
  const host = options.host ?? config.api.host

  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      logger.info('filecoin_api_started', { host, port })
      resolve(Object.freeze({
        server,
        app,
        address: () => server.address(),
        stop: () => new Promise((res, rej) => {
          server.close(err => err ? rej(err) : res())
        })
      }))
    })
    server.once('error', reject)
  })
}
