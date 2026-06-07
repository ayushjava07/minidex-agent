import http from 'node:http'
import { getNetworkStatus } from './network.js'
import { createLogger } from './logger.js'
import { createHealthMonitor, loadHealthMonitorConfig } from './health-monitor.js'
import { healthMetrics, metrics } from './metrics.js'
import { createRuntimeMetricsCollector } from './runtime-metrics.js'

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

function sendMetrics(response, registry) {
    response.writeHead(200, { 'content-type': 'text/plain; version=0.0.4; charset=utf-8' })
    response.end(registry.render())
}

export async function startHealthServer(node, options = {}) {
    const role = node.role
    const port = options.port ?? HEALTH_PORTS[role]
    const env = options.env ?? process.env
    const configuredHost = options.host ?? env.HEALTH_HOST ?? '127.0.0.1'
    const minPeers = options.minPeers ?? Number(env.HEALTH_MIN_PEERS || 1)
    const metricsRegistry = options.metrics ?? metrics
    const runtimeCollector = options.runtimeMetricsCollector ?? createRuntimeMetricsCollector({ role })
    const monitorConfig = loadHealthMonitorConfig(env)
    const startedAt = Date.now()

    if (!Number.isInteger(port) || port < 0 || port > 65535) {
        throw new Error('Health server port must be an integer between 0 and 65535')
    }
    if (typeof configuredHost !== 'string' || configuredHost.trim() === '') {
        throw new Error('HEALTH_HOST must be a non-empty string')
    }
    if (!Number.isInteger(minPeers) || minPeers < 0) {
        throw new Error('HEALTH_MIN_PEERS must be a non-negative integer')
    }
    const host = configuredHost.trim()

    const monitor = createHealthMonitor({
        checkTimeoutMs: options.checkTimeoutMs ?? monitorConfig.checkTimeoutMs,
        checks: [
            {
                name: 'network',
                check: () => {
                    const network = getNetworkStatus(node)
                    if (network.peers < minPeers) {
                        throw new Error(`Connected peers ${network.peers} below required minimum ${minPeers}`)
                    }
                    return { peers: network.peers, requiredPeers: minPeers }
                }
            },
            ...(options.checks ?? [])
        ]
    })

    const server = http.createServer(async (request, response) => {
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
            const result = await monitor.evaluate()
            for (const check of result.checks) {
                healthMetrics.checkStatus.set({ check: check.name, role }, check.status === 'pass' ? 1 : 0)
                healthMetrics.checkDuration.observe({ check: check.name, role }, check.latencyMs / 1000)
            }
            healthMetrics.readiness.set({ role }, result.ready ? 1 : 0)
            sendJson(response, result.ready ? 200 : 503, {
                status: result.status,
                checks: result.checks,
                ...base
            })
            return
        }

        if (request.url === '/metrics') {
            sendMetrics(response, metricsRegistry)
            return
        }

        sendJson(response, 404, { status: 'not_found' })
    })

    await new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(port, host, resolve)
    })

    const address = server.address()
    runtimeCollector.start()
    logger.info('health_server_started', { role, host, port: address.port, minPeers })

    return Object.freeze({
        address: () => server.address(),
        check: () => monitor.evaluate(),
        registerCheck: check => monitor.register(check),
        stop: () => {
            runtimeCollector.stop()
            return new Promise((resolve, reject) => {
                server.close(error => error ? reject(error) : resolve())
            })
        }
    })
}
