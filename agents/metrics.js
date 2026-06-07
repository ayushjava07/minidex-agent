const METRIC_NAME_PATTERN = /^[a-zA-Z_:][a-zA-Z0-9_:]*$/
const LABEL_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/
const DEFAULT_HISTOGRAM_BUCKETS = Object.freeze([0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10])

function assertMetricName(name) {
    if (typeof name !== 'string' || !METRIC_NAME_PATTERN.test(name)) {
        throw new Error(`Invalid metric name: ${name}`)
    }
    return name
}

function assertHelp(help) {
    if (typeof help !== 'string' || help.trim() === '') {
        throw new Error('Metric help must be a non-empty string')
    }
    return help.trim()
}

function normalizeLabelNames(labelNames = []) {
    if (!Array.isArray(labelNames)) throw new Error('Metric label names must be an array')

    const unique = new Set()
    for (const name of labelNames) {
        if (typeof name !== 'string' || !LABEL_NAME_PATTERN.test(name)) {
            throw new Error(`Invalid metric label name: ${name}`)
        }
        if (unique.has(name)) throw new Error(`Duplicate metric label name: ${name}`)
        unique.add(name)
    }
    return Object.freeze([...unique].sort())
}

function escapeLabelValue(value) {
    return String(value)
        .replaceAll('\\', '\\\\')
        .replaceAll('\n', '\\n')
        .replaceAll('"', '\\"')
}

function escapeHelp(value) {
    return value.replaceAll('\\', '\\\\').replaceAll('\n', '\\n')
}

function normalizeLabels(expectedNames, labels = {}) {
    if (!labels || typeof labels !== 'object' || Array.isArray(labels)) {
        throw new Error('Metric labels must be an object')
    }

    const suppliedNames = Object.keys(labels).sort()
    if (suppliedNames.length !== expectedNames.length
        || suppliedNames.some((name, index) => name !== expectedNames[index])) {
        throw new Error(`Metric labels must contain exactly: ${expectedNames.join(', ') || '(none)'}`)
    }

    const normalized = {}
    for (const name of expectedNames) normalized[name] = String(labels[name])
    return Object.freeze(normalized)
}

function labelKey(labelNames, labels) {
    return labelNames.map(name => `${name}\0${labels[name]}`).join('\0')
}

function renderLabels(labels, extra = {}) {
    const entries = [...Object.entries(labels), ...Object.entries(extra)]
    if (entries.length === 0) return ''
    return `{${entries.map(([name, value]) => `${name}="${escapeLabelValue(value)}"`).join(',')}}`
}

function assertFiniteNumber(value, name) {
    if (!Number.isFinite(value)) throw new Error(`${name} must be a finite number`)
    return value
}

class Metric {
    constructor(type, name, help, labelNames) {
        this.type = type
        this.name = assertMetricName(name)
        this.help = assertHelp(help)
        this.labelNames = normalizeLabelNames(labelNames)
        this.values = new Map()
    }

    normalize(labels) {
        const normalized = normalizeLabels(this.labelNames, labels)
        return { labels: normalized, key: labelKey(this.labelNames, normalized) }
    }

    header() {
        return [
            `# HELP ${this.name} ${escapeHelp(this.help)}`,
            `# TYPE ${this.name} ${this.type}`
        ]
    }
}

class Counter extends Metric {
    constructor(name, help, labelNames) {
        super('counter', name, help, labelNames)
    }

    inc(labels = {}, amount = 1) {
        assertFiniteNumber(amount, 'Counter increment')
        if (amount < 0) throw new Error('Counter increment must not be negative')
        const normalized = this.normalize(labels)
        const current = this.values.get(normalized.key)?.value ?? 0
        this.values.set(normalized.key, { labels: normalized.labels, value: current + amount })
    }

    render() {
        return [
            ...this.header(),
            ...[...this.values.values()].map(entry => `${this.name}${renderLabels(entry.labels)} ${entry.value}`)
        ]
    }
}

class Gauge extends Metric {
    constructor(name, help, labelNames) {
        super('gauge', name, help, labelNames)
    }

    set(labels = {}, value) {
        assertFiniteNumber(value, 'Gauge value')
        const normalized = this.normalize(labels)
        this.values.set(normalized.key, { labels: normalized.labels, value })
    }

    inc(labels = {}, amount = 1) {
        assertFiniteNumber(amount, 'Gauge increment')
        const normalized = this.normalize(labels)
        const current = this.values.get(normalized.key)?.value ?? 0
        this.values.set(normalized.key, { labels: normalized.labels, value: current + amount })
    }

    dec(labels = {}, amount = 1) {
        this.inc(labels, -amount)
    }

    render() {
        return [
            ...this.header(),
            ...[...this.values.values()].map(entry => `${this.name}${renderLabels(entry.labels)} ${entry.value}`)
        ]
    }
}

class Histogram extends Metric {
    constructor(name, help, labelNames, buckets = DEFAULT_HISTOGRAM_BUCKETS) {
        super('histogram', name, help, labelNames)
        if (!Array.isArray(buckets) || buckets.length === 0) {
            throw new Error('Histogram buckets must be a non-empty array')
        }
        this.buckets = Object.freeze([...new Set(buckets.map(value => assertFiniteNumber(value, 'Histogram bucket')))]
            .sort((left, right) => left - right))
    }

    observe(labels = {}, value) {
        assertFiniteNumber(value, 'Histogram observation')
        const normalized = this.normalize(labels)
        const current = this.values.get(normalized.key) ?? {
            labels: normalized.labels,
            count: 0,
            sum: 0,
            buckets: this.buckets.map(() => 0)
        }

        current.count++
        current.sum += value
        this.buckets.forEach((upperBound, index) => {
            if (value <= upperBound) current.buckets[index]++
        })
        this.values.set(normalized.key, current)
    }

    render() {
        const lines = this.header()
        for (const entry of this.values.values()) {
            this.buckets.forEach((upperBound, index) => {
                lines.push(`${this.name}_bucket${renderLabels(entry.labels, { le: upperBound })} ${entry.buckets[index]}`)
            })
            lines.push(`${this.name}_bucket${renderLabels(entry.labels, { le: '+Inf' })} ${entry.count}`)
            lines.push(`${this.name}_sum${renderLabels(entry.labels)} ${entry.sum}`)
            lines.push(`${this.name}_count${renderLabels(entry.labels)} ${entry.count}`)
        }
        return lines
    }
}

export function createMetricsRegistry() {
    const metrics = new Map()

    function register(type, name, help, labelNames, options = {}) {
        if (metrics.has(name)) throw new Error(`Metric already registered: ${name}`)
        const metric = type === 'counter'
            ? new Counter(name, help, labelNames)
            : type === 'gauge'
                ? new Gauge(name, help, labelNames)
                : new Histogram(name, help, labelNames, options.buckets)
        metrics.set(name, metric)
        return metric
    }

    return Object.freeze({
        counter: (name, help, labelNames = []) => register('counter', name, help, labelNames),
        gauge: (name, help, labelNames = []) => register('gauge', name, help, labelNames),
        histogram: (name, help, labelNames = [], options = {}) => register('histogram', name, help, labelNames, options),
        render() {
            if (metrics.size === 0) return ''
            return `${[...metrics.values()].flatMap(metric => metric.render()).join('\n')}\n`
        },
        reset() {
            for (const metric of metrics.values()) metric.values.clear()
        }
    })
}

export const metrics = createMetricsRegistry()

export const networkMetrics = Object.freeze({
    connectedPeers: metrics.gauge(
        'atos_network_connected_peers',
        'Current number of unique peers connected to an agent.',
        ['role']
    ),
    messagesReceived: metrics.counter(
        'atos_network_messages_received_total',
        'Total authenticated network messages received.',
        ['role', 'topic']
    ),
    messagesSent: metrics.counter(
        'atos_network_messages_sent_total',
        'Total network messages sent to peers.',
        ['role', 'topic']
    ),
    messageFailures: metrics.counter(
        'atos_network_message_failures_total',
        'Total network message processing or delivery failures.',
        ['direction', 'reason', 'role']
    ),
    messageBytes: metrics.histogram(
        'atos_network_message_bytes',
        'Size of network messages in bytes.',
        ['direction', 'role'],
        { buckets: [128, 512, 1024, 4096, 16384, 65536] }
    )
})

export function classifyMetricError(error) {
    const message = error?.message ?? ''
    if (message.includes('authentication')) return 'authentication'
    if (message.includes('Replay')) return 'replay'
    if (message.includes('maximum size')) return 'oversized'
    if (message.includes('schema') || message.includes('envelope') || message.includes('JSON')) return 'validation'
    if (message.includes('close')) return 'stream_close'
    return 'unknown'
}
