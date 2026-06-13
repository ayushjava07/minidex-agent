import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createFilecoinRouter } from './filecoin/routes.js'
import { createFilecoinDashboardRouter } from './routes/filecoin-dashboard.js'
import { getAgentStatus } from './routes/agent-status.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND_DIST = path.resolve(__dirname, '..', 'frontend', 'dist')

export function createApp(options = {}) {
  const app = express()

  app.use(express.json({ limit: '200mb' }))
  app.use('/api/v1/filecoin', createFilecoinRouter(options))
  app.use('/api/filecoin', createFilecoinDashboardRouter())
  app.get('/api/agent-status', getAgentStatus)

  if (!options.noStatic) {
    app.use(express.static(FRONTEND_DIST))
    app.get('/{*path}', (req, res) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API route not found' })
      }
      res.sendFile(path.join(FRONTEND_DIST, 'index.html'))
    })
  }

  return app
}
