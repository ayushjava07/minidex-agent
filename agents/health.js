import http from 'node:http'
import { getNetworkStatus } from './network.js'
import { createLogger } from './logger.js'

const logger = createLogger('health')

const HEALTH_PORTS = Object.freeze({
    deploy: 4101,
    monitor: 4102,
    report: 4103,
    liquidity: 4104,
    analytics: 4105
})

function sendJson(response, statusCode, body) {
    response.writeHead(statusCode, { 'content-type': 'application/json' })
    response.end(JSON.stringify(body))
}

export async function startHealthServer(node, options = {}) {
    const role = node.role
    const port = options.port ?? HEALTH_PORTS[role]
    const host = options.host ?? process.env.HEALTH_HOST ?? '127.0.0.1'
    const minPeers = options.minPeers ?? Number(process.env.HEALTH_MIN_PEERS || 1)
    const startedAt = Date.now()

    if (!Number.isInteger(port) || port < 0 || port > 65535) {
        throw new Error('Health server port must be an integer between 0 and 65535')
    }
    if (!Number.isInteger(minPeers) || minPeers < 0) {
        throw new Error('HEALTH_MIN_PEERS must be a non-negative integer')
    }

    const server = http.createServer((request, response) => {
        const network = getNetworkStatus(node)
        const base = {
            role,
            uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
            peers: network.peers,
            requiredPeers: minPeers
        }

        if (request.url === '/health/live') {
            sendJson(response, 200, { status: 'ok', ...base })
            return
        }

        if (request.url === '/health/ready') {
            const ready = network.peers >= minPeers
            sendJson(response, ready ? 200 : 503, {
                status: ready ? 'ready' : 'not_ready',
                ...base
            })
            return
        }

        sendJson(response, 404, { status: 'not_found' })
    })

    await new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(port, host, resolve)
    })

    const address = server.address()
    logger.info('health_server_started', { role, host, port: address.port, minPeers })

    return Object.freeze({
        address: () => server.address(),
        stop: () => new Promise((resolve, reject) => {
            server.close(error => error ? reject(error) : resolve())
        })
    })
}
