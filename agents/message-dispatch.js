const DEFAULT_HANDLER_TIMEOUT_MS = 5000
const DEFAULT_HANDLER_CONCURRENCY = 4

function requirePositiveInteger(value, name) {
    if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`)
    return value
}

export function loadMessageDispatchConfig(env = process.env) {
    return Object.freeze({
        timeoutMs: requirePositiveInteger(
            Number(env.NETWORK_HANDLER_TIMEOUT_MS || DEFAULT_HANDLER_TIMEOUT_MS),
            'NETWORK_HANDLER_TIMEOUT_MS'
        ),
        concurrency: requirePositiveInteger(
            Number(env.NETWORK_HANDLER_CONCURRENCY || DEFAULT_HANDLER_CONCURRENCY),
            'NETWORK_HANDLER_CONCURRENCY'
        )
    })
}

function timeoutError(timeoutMs) {
    const error = new Error(`Topic handler timed out after ${timeoutMs}ms`)
    error.name = 'HandlerTimeoutError'
    error.code = 'HANDLER_TIMEOUT'
    return error
}

async function runWithTimeout(handler, data, context, timeoutMs) {
    let timer
    try {
        return await Promise.race([
            Promise.resolve().then(() => handler(data, context)),
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(timeoutError(timeoutMs)), timeoutMs)
                timer.unref?.()
            })
        ])
    } finally {
        clearTimeout(timer)
    }
}

export function createMessageDispatcher(options = {}) {
    const timeoutMs = requirePositiveInteger(options.timeoutMs ?? DEFAULT_HANDLER_TIMEOUT_MS, 'timeoutMs')
    const concurrency = requirePositiveInteger(options.concurrency ?? DEFAULT_HANDLER_CONCURRENCY, 'concurrency')

    return Object.freeze({
        async dispatch(handlers, data, context = {}) {
            const queue = [...handlers]
            if (queue.some(handler => typeof handler !== 'function')) {
                throw new Error('Message handlers must be functions')
            }

            const results = new Array(queue.length)
            let nextIndex = 0
            async function worker() {
                while (nextIndex < queue.length) {
                    const index = nextIndex++
                    try {
                        const value = await runWithTimeout(queue[index], data, context, timeoutMs)
                        results[index] = Object.freeze({ status: 'fulfilled', value })
                    } catch (error) {
                        results[index] = Object.freeze({ status: 'rejected', error })
                        options.onError?.(error, { ...context, handlerIndex: index })
                    }
                }
            }

            const workers = Array.from({ length: Math.min(concurrency, queue.length) }, () => worker())
            await Promise.all(workers)
            const failed = results.filter(result => result.status === 'rejected').length
            return Object.freeze({
                total: results.length,
                succeeded: results.length - failed,
                failed,
                results: Object.freeze(results)
            })
        }
    })
}
