import { runtimeMetrics } from './metrics.js'

function requirePositiveInteger(value, name) {
    if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`)
    return value
}

function requireFunction(value, name) {
    if (typeof value !== 'function') throw new Error(`${name} must be a function`)
    return value
}

export function createRuntimeMetricsCollector(options = {}) {
    const role = options.role
    if (typeof role !== 'string' || role.trim() === '') {
        throw new Error('Runtime metrics collector role must be a non-empty string')
    }

    const intervalMs = requirePositiveInteger(options.intervalMs ?? 10_000, 'intervalMs')
    const metricSet = options.metrics ?? runtimeMetrics
    const memoryUsage = options.memoryUsage ?? process.memoryUsage
    const cpuUsage = options.cpuUsage ?? process.cpuUsage
    const uptime = options.uptime ?? process.uptime
    const clock = options.clock ?? Date.now
    const schedule = options.schedule ?? setInterval
    const cancel = options.cancel ?? clearInterval
    requireFunction(memoryUsage, 'memoryUsage')
    requireFunction(cpuUsage, 'cpuUsage')
    requireFunction(uptime, 'uptime')
    requireFunction(clock, 'clock')
    requireFunction(schedule, 'schedule')
    requireFunction(cancel, 'cancel')

    let timer
    let lastCpu = cpuUsage()
    let expectedAt = clock() + intervalMs
    let lastSnapshot

    function setMetric(metric, value) {
        if (!Number.isFinite(value)) throw new Error('Runtime metric value must be finite')
        metric.set({ role }, value)
    }

    function collect() {
        const timestamp = clock()
        const memory = memoryUsage()
        const cpu = cpuUsage(lastCpu)
        lastCpu = cpuUsage()
        const eventLoopLagMs = Math.max(0, timestamp - expectedAt)
        expectedAt = timestamp + intervalMs

        setMetric(metricSet.uptimeSeconds, uptime())
        setMetric(metricSet.residentMemoryBytes, memory.rss)
        setMetric(metricSet.heapUsedBytes, memory.heapUsed)
        setMetric(metricSet.heapTotalBytes, memory.heapTotal)
        setMetric(metricSet.externalMemoryBytes, memory.external ?? 0)
        setMetric(metricSet.cpuUserSeconds, cpu.user / 1_000_000)
        setMetric(metricSet.cpuSystemSeconds, cpu.system / 1_000_000)
        setMetric(metricSet.eventLoopLagSeconds, eventLoopLagMs / 1000)

        lastSnapshot = Object.freeze({
            role,
            timestamp,
            uptimeSeconds: uptime(),
            memory: Object.freeze({
                rssBytes: memory.rss,
                heapUsedBytes: memory.heapUsed,
                heapTotalBytes: memory.heapTotal,
                externalBytes: memory.external ?? 0
            }),
            cpu: Object.freeze({
                userSeconds: cpu.user / 1_000_000,
                systemSeconds: cpu.system / 1_000_000
            }),
            eventLoopLagSeconds: eventLoopLagMs / 1000
        })
        return lastSnapshot
    }

    function start() {
        if (timer !== undefined) return false
        collect()
        timer = schedule(collect, intervalMs)
        timer?.unref?.()
        return true
    }

    function stop() {
        if (timer === undefined) return false
        cancel(timer)
        timer = undefined
        return true
    }

    return Object.freeze({
        collect,
        start,
        stop,
        snapshot: () => lastSnapshot,
        get running() {
            return timer !== undefined
        }
    })
}
