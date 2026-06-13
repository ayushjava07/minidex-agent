import { createLogger } from '../../agents/logger.js'
import { loadFilecoinConfig } from './config.js'

const logger = createLogger('filecoin-middleware')

export function createFilecoinRateLimiter(maxRps) {
  const ipBuckets = new Map()
  const rate = maxRps || 10
  const windowMs = 1000

  function cleanup() {
    const now = Date.now()
    for (const [key, bucket] of ipBuckets) {
      if (now - bucket.resetAt > windowMs * 2) {
        ipBuckets.delete(key)
      }
    }
  }

  return function rateLimit(req, res, next) {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown'
    const now = Date.now()
    let bucket = ipBuckets.get(ip)

    if (!bucket || now - bucket.resetAt > windowMs) {
      bucket = { count: 0, resetAt: now + windowMs }
      ipBuckets.set(ip, bucket)
    }

    bucket.count++
    res.setHeader('X-RateLimit-Limit', rate)
    res.setHeader('X-RateLimit-Remaining', Math.max(0, rate - bucket.count))
    res.setHeader('X-RateLimit-Reset', bucket.resetAt)

    if (bucket.count > rate) {
      logger.warn('filecoin_rate_limited', { ip, count: bucket.count })
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000)
      res.status(429).json({ error: 'Too many requests', retryAfter })
      return
    }

    next()
    if (ipBuckets.size > 10000) cleanup()
  }
}

export function createFilecoinAuthMiddleware(apiToken) {
  const token = apiToken || process.env.FILECOIN_API_TOKEN

  return function auth(req, res, next) {
    if (!token) return next()

    const provided = req.headers.authorization?.replace('Bearer ', '')?.trim()
    if (!provided || provided !== token) {
      logger.warn('filecoin_auth_failed', { ip: req.ip })
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    next()
  }
}

export function createFilecoinValidationMiddleware() {
  return function validate(req, res, next) {
    const cid = req.params?.cid || req.body?.cid

    if (cid && !/^b[A-Za-z2-7]{58,}$/.test(cid)) {
      res.status(400).json({ error: 'Invalid CID format' })
      return
    }

    if (req.method === 'POST' && req.url === '/api/v1/store') {
      if (!req.body || Object.keys(req.body).length === 0) {
        res.status(400).json({ error: 'Request body is required' })
        return
      }
    }

    next()
  }
}
