const LEVEL_PRIORITY = Object.freeze({
    debug: 10,
    info: 20,
    warn: 30,
    error: 40
})

function normalizeLevel(level) {
    const normalized = (level || 'info').toLowerCase()
    if (!(normalized in LEVEL_PRIORITY)) {
        throw new Error(`LOG_LEVEL must be one of: ${Object.keys(LEVEL_PRIORITY).join(', ')}`)
    }
    return normalized
}

function normalizeFields(fields) {
    return Object.fromEntries(Object.entries(fields).map(([key, value]) => {
        if (value instanceof Error) {
            return [key, {
                name: value.name,
                message: value.message,
                stack: value.stack
            }]
        }
        if (typeof value === 'bigint') {
            return [key, value.toString()]
        }
        return [key, value]
    }))
}

export function createLogger(component, options = {}) {
    const minimumLevel = normalizeLevel(options.level ?? process.env.LOG_LEVEL)
    const sink = options.sink ?? (line => console.log(line))
    const clock = options.clock ?? (() => new Date())

    function emit(level, event, fields = {}) {
        if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[minimumLevel]) return

        sink(JSON.stringify({
            timestamp: clock().toISOString(),
            level,
            component,
            event,
            ...normalizeFields(fields)
        }))
    }

    return Object.freeze({
        debug: (event, fields) => emit('debug', event, fields),
        info: (event, fields) => emit('info', event, fields),
        warn: (event, fields) => emit('warn', event, fields),
        error: (event, fields) => emit('error', event, fields)
    })
}
