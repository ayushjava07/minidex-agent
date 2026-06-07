const CHECK_NAME_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/
const DEFAULT_CHECK_TIMEOUT_MS = 2000

function requirePositiveInteger(value, name) {
    if (!Number.isInteger(value) || value < 1) {
        throw new Error(`${name} must be a positive integer`)
    }
    return value
}

function validateCheck(check, defaultTimeoutMs) {
    if (!check || typeof check !== 'object' || Array.isArray(check)) {
        throw new Error('Health check must be an object')
    }
    if (typeof check.name !== 'string' || !CHECK_NAME_PATTERN.test(check.name)) {
        throw new Error('Health check name must be a lowercase identifier')
    }
    if (typeof check.check !== 'function') {
        throw new Error(`Health check "${check.name}" must provide a check function`)
    }
    if (check.critical !== undefined && typeof check.critical !== 'boolean') {
        throw new Error(`Health check "${check.name}" critical must be a boolean`)
    }

    return Object.freeze({
        name: check.name,
        check: check.check,
        critical: check.critical ?? true,
        timeoutMs: requirePositiveInteger(check.timeoutMs ?? defaultTimeoutMs, `Health check "${check.name}" timeoutMs`)
    })
}

function errorMessage(error) {
    if (error instanceof Error && error.message) return error.message
    return String(error || 'Health check failed')
}

async function withTimeout(operation, timeoutMs, name) {
    let timer
    try {
        return await Promise.race([
            Promise.resolve().then(operation),
            new Promise((_, reject) => {
                timer = setTimeout(
                    () => reject(new Error(`Health check "${name}" timed out after ${timeoutMs}ms`)),
                    timeoutMs
                )
                timer.unref?.()
            })
        ])
    } finally {
        clearTimeout(timer)
    }
}

export function loadHealthMonitorConfig(env = process.env) {
    return Object.freeze({
        checkTimeoutMs: requirePositiveInteger(
            Number(env.HEALTH_CHECK_TIMEOUT_MS || DEFAULT_CHECK_TIMEOUT_MS),
            'HEALTH_CHECK_TIMEOUT_MS'
        )
    })
}

export function createHealthMonitor(options = {}) {
    const defaultTimeoutMs = requirePositiveInteger(
        options.checkTimeoutMs ?? DEFAULT_CHECK_TIMEOUT_MS,
        'checkTimeoutMs'
    )
    const clock = options.clock ?? Date.now
    const checks = new Map()

    function register(check) {
        const validated = validateCheck(check, defaultTimeoutMs)
        if (checks.has(validated.name)) {
            throw new Error(`Health check already registered: ${validated.name}`)
        }
        checks.set(validated.name, validated)
        return validated
    }

    for (const check of options.checks ?? []) register(check)

    async function runCheck(check) {
        const startedAt = clock()
        try {
            const details = await withTimeout(check.check, check.timeoutMs, check.name)
            if (details === false) throw new Error('Health check returned false')
            return Object.freeze({
                name: check.name,
                status: 'pass',
                critical: check.critical,
                latencyMs: Math.max(0, clock() - startedAt),
                ...(details && typeof details === 'object' ? { details } : {})
            })
        } catch (error) {
            return Object.freeze({
                name: check.name,
                status: 'fail',
                critical: check.critical,
                latencyMs: Math.max(0, clock() - startedAt),
                error: errorMessage(error)
            })
        }
    }

    async function evaluate() {
        const results = await Promise.all([...checks.values()].map(runCheck))
        const criticalFailure = results.some(result => result.critical && result.status === 'fail')
        const optionalFailure = results.some(result => !result.critical && result.status === 'fail')

        return Object.freeze({
            status: criticalFailure ? 'not_ready' : optionalFailure ? 'degraded' : 'ready',
            ready: !criticalFailure,
            checks: Object.freeze(results)
        })
    }

    return Object.freeze({
        register,
        evaluate,
        get size() {
            return checks.size
        }
    })
}
