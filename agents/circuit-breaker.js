const STATES = Object.freeze({
    CLOSED: 'closed',
    OPEN: 'open',
    HALF_OPEN: 'half_open'
})

function requirePositiveInteger(value, name) {
    if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`)
    return value
}

function requireFunction(value, name) {
    if (typeof value !== 'function') throw new Error(`${name} must be a function`)
    return value
}

export class CircuitOpenError extends Error {
    constructor(retryAfterMs) {
        super(`Circuit breaker is open; retry after ${retryAfterMs}ms`)
        this.name = 'CircuitOpenError'
        this.code = 'CIRCUIT_OPEN'
        this.retryAfterMs = retryAfterMs
    }
}

export function createCircuitBreaker(options = {}) {
    const failureThreshold = requirePositiveInteger(options.failureThreshold ?? 5, 'failureThreshold')
    const successThreshold = requirePositiveInteger(options.successThreshold ?? 1, 'successThreshold')
    const resetTimeoutMs = requirePositiveInteger(options.resetTimeoutMs ?? 30_000, 'resetTimeoutMs')
    const clock = options.clock ?? Date.now
    const shouldCountFailure = options.shouldCountFailure ?? (() => true)
    requireFunction(clock, 'clock')
    requireFunction(shouldCountFailure, 'shouldCountFailure')

    let state = STATES.CLOSED
    let consecutiveFailures = 0
    let halfOpenSuccesses = 0
    let openedAt = 0
    let halfOpenProbeActive = false
    const totals = {
        executions: 0,
        successes: 0,
        failures: 0,
        rejected: 0,
        opened: 0
    }

    function now() {
        const value = clock()
        if (!Number.isFinite(value) || value < 0) throw new Error('Circuit breaker clock returned an invalid timestamp')
        return value
    }

    function transition(nextState) {
        if (state === nextState) return
        state = nextState
        options.onStateChange?.(snapshot())
    }

    function open(timestamp) {
        openedAt = timestamp
        halfOpenSuccesses = 0
        halfOpenProbeActive = false
        totals.opened++
        transition(STATES.OPEN)
    }

    function close() {
        consecutiveFailures = 0
        halfOpenSuccesses = 0
        halfOpenProbeActive = false
        transition(STATES.CLOSED)
    }

    function prepareExecution(timestamp) {
        if (state === STATES.OPEN) {
            const elapsed = timestamp - openedAt
            if (elapsed < resetTimeoutMs) {
                totals.rejected++
                throw new CircuitOpenError(resetTimeoutMs - elapsed)
            }
            transition(STATES.HALF_OPEN)
        }

        if (state === STATES.HALF_OPEN) {
            if (halfOpenProbeActive) {
                totals.rejected++
                throw new CircuitOpenError(resetTimeoutMs)
            }
            halfOpenProbeActive = true
        }
    }

    function recordSuccess() {
        totals.successes++
        if (state === STATES.HALF_OPEN) {
            halfOpenProbeActive = false
            halfOpenSuccesses++
            if (halfOpenSuccesses >= successThreshold) close()
            return
        }
        consecutiveFailures = 0
    }

    function recordFailure(error, timestamp) {
        totals.failures++
        if (state === STATES.HALF_OPEN) {
            halfOpenProbeActive = false
            open(timestamp)
            return
        }
        if (!shouldCountFailure(error)) return
        consecutiveFailures++
        if (consecutiveFailures >= failureThreshold) open(timestamp)
    }

    async function execute(operation) {
        requireFunction(operation, 'Circuit breaker operation')
        const timestamp = now()
        prepareExecution(timestamp)
        totals.executions++
        try {
            const result = await operation()
            recordSuccess()
            return result
        } catch (error) {
            recordFailure(error, now())
            throw error
        }
    }

    function snapshot() {
        const timestamp = now()
        return Object.freeze({
            state,
            consecutiveFailures,
            halfOpenSuccesses,
            retryAfterMs: state === STATES.OPEN ? Math.max(0, resetTimeoutMs - (timestamp - openedAt)) : 0,
            ...totals
        })
    }

    function reset() {
        consecutiveFailures = 0
        halfOpenSuccesses = 0
        openedAt = 0
        halfOpenProbeActive = false
        transition(STATES.CLOSED)
    }

    return Object.freeze({ execute, snapshot, reset })
}
