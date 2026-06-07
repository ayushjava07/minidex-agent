function requireNonNegativeInteger(value, name) {
    if (!Number.isInteger(value) || value < 0) {
        throw new Error(`${name} must be a non-negative integer`)
    }
    return value
}

function requirePositiveInteger(value, name) {
    if (!Number.isInteger(value) || value < 1) {
        throw new Error(`${name} must be a positive integer`)
    }
    return value
}

function requireRatio(value, name) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new Error(`${name} must be a number between 0 and 1`)
    }
    return value
}

function abortError(signal) {
    const error = new Error(signal?.reason ? `Retry aborted: ${signal.reason}` : 'Retry aborted')
    error.name = 'AbortError'
    error.code = 'ABORT_ERR'
    return error
}

function assertNotAborted(signal) {
    if (signal?.aborted) throw abortError(signal)
}

function wait(delayMs, signal) {
    return new Promise((resolve, reject) => {
        assertNotAborted(signal)
        const cleanup = () => signal?.removeEventListener('abort', abort)
        const timer = setTimeout(() => {
            cleanup()
            resolve()
        }, delayMs)
        const abort = () => {
            clearTimeout(timer)
            cleanup()
            reject(abortError(signal))
        }
        signal?.addEventListener('abort', abort, { once: true })
        timer.unref?.()
    })
}

export function calculateRetryDelay(attempt, options = {}) {
    requirePositiveInteger(attempt, 'attempt')
    const initialDelayMs = requireNonNegativeInteger(options.initialDelayMs ?? 200, 'initialDelayMs')
    const maxDelayMs = requireNonNegativeInteger(options.maxDelayMs ?? 2000, 'maxDelayMs')
    const jitterRatio = requireRatio(options.jitterRatio ?? 0, 'jitterRatio')
    const random = options.random ?? Math.random
    const bounded = Math.min(initialDelayMs * (2 ** (attempt - 1)), maxDelayMs)
    if (jitterRatio === 0 || bounded === 0) return bounded

    const jitter = bounded * jitterRatio
    return Math.round(Math.max(0, bounded - jitter + random() * jitter * 2))
}

export function isTransientNetworkError(error) {
    if (!error) return false
    if (error.code === 'ABORT_ERR' || error.name === 'AbortError') return false
    if (['ERR_INVALID_ARG_VALUE', 'ERR_INVALID_PROTOCOL', 'INVALID_CONFIGURATION'].includes(error.code)) return false
    if (/authentication|validation|invalid|unsupported|unknown role/i.test(error.message || '')) return false
    return true
}

export function loadRetryConfig(env = process.env) {
    return Object.freeze({
        maxAttempts: requirePositiveInteger(Number(env.NETWORK_RETRY_ATTEMPTS || 3), 'NETWORK_RETRY_ATTEMPTS'),
        initialDelayMs: requireNonNegativeInteger(Number(env.NETWORK_RETRY_DELAY_MS || 200), 'NETWORK_RETRY_DELAY_MS'),
        maxDelayMs: requireNonNegativeInteger(Number(env.NETWORK_RETRY_MAX_DELAY_MS || 2000), 'NETWORK_RETRY_MAX_DELAY_MS')
    })
}

export async function withRetry(operation, options = {}) {
    const maxAttempts = requirePositiveInteger(options.maxAttempts ?? 3, 'maxAttempts')
    const initialDelayMs = requireNonNegativeInteger(options.initialDelayMs ?? 200, 'initialDelayMs')
    const maxDelayMs = requireNonNegativeInteger(options.maxDelayMs ?? 2000, 'maxDelayMs')
    const jitterRatio = requireRatio(options.jitterRatio ?? 0, 'jitterRatio')
    const sleep = options.sleep ?? ((delay, signal) => wait(delay, signal))
    const shouldRetry = options.shouldRetry ?? (() => true)
    const signal = options.signal

    let lastError
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        assertNotAborted(signal)
        try {
            return await operation(attempt)
        } catch (error) {
            lastError = error
            const retryable = shouldRetry(error, attempt)
            if (attempt === maxAttempts || !retryable) {
                options.onGiveUp?.({ attempt, error, retryable })
                break
            }

            const delayMs = calculateRetryDelay(attempt, {
                initialDelayMs,
                maxDelayMs,
                jitterRatio,
                random: options.random
            })
            options.onRetry?.({ attempt, delayMs, error })
            await sleep(delayMs, signal)
        }
    }

    throw lastError
}

export function createRetryManager(defaults = {}) {
    const stats = { operations: 0, retries: 0, successes: 0, failures: 0 }

    return Object.freeze({
        async execute(operation, options = {}) {
            stats.operations++
            try {
                const result = await withRetry(operation, {
                    ...defaults,
                    ...options,
                    onRetry(event) {
                        stats.retries++
                        defaults.onRetry?.(event)
                        options.onRetry?.(event)
                    },
                    onGiveUp(event) {
                        defaults.onGiveUp?.(event)
                        options.onGiveUp?.(event)
                    }
                })
                stats.successes++
                return result
            } catch (error) {
                stats.failures++
                throw error
            }
        },
        stats() {
            return Object.freeze({ ...stats })
        }
    })
}
