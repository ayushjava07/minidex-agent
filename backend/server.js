import { fileURLToPath } from 'node:url'
import { createLogger } from '../agents/logger.js'
import { createApp } from './app.js'

const logger = createLogger('server')

export function createServer(options = {}) {
  const app = createApp(options)
  const port = options.port ?? (Number(process.env.PORT) || 3000)
  const host = options.host ?? (process.env.HOST || '0.0.0.0')
  return { app, port, host }
}

export async function startServer(options = {}) {
  const { app, port, host } = createServer(options)
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      logger.info('server_started', { host, port, frontend: options.noStatic ? 'disabled' : 'enabled' })
      resolve(server)
    })
    server.once('error', reject)
  })
}

const isMain = process.argv[1] && (process.argv[1] === fileURLToPath(import.meta.url) || process.argv[1].endsWith('server.js'))
if (isMain) {
  startServer().catch(err => { logger.error('server_fatal', { error: err.message }); process.exit(1) })
}
