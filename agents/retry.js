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
    const sleep = options.sleep ?? (delay => new Promise(resolve => setTimeout(resolve, delay)))

    let lastError
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await operation(attempt)
        } catch (error) {
            lastError = error
            if (attempt === maxAttempts) break

            const delayMs = Math.min(initialDelayMs * (2 ** (attempt - 1)), maxDelayMs)
            options.onRetry?.({ attempt, delayMs, error })
            await sleep(delayMs)
        }
    }

    throw lastError
}
