import { messageRateLimitKey } from './rate-limit.js'
import { verifyMessageAuthentication } from './message-auth.js'

function requireFunction(value, name) {
    if (typeof value !== 'function') throw new Error(`${name} must be a function`)
    return value
}

export function composeMessageMiddleware(middleware) {
    if (!Array.isArray(middleware)) throw new Error('Message middleware must be an array')
    middleware.forEach((entry, index) => requireFunction(entry, `Message middleware at index ${index}`))

    return async function execute(context) {
        if (!context || typeof context !== 'object' || Array.isArray(context)) {
            throw new Error('Message middleware context must be an object')
        }

        let lastIndex = -1
        async function dispatch(index) {
            if (index <= lastIndex) throw new Error('Message middleware next() called more than once')
            lastIndex = index
            const current = middleware[index]
            if (!current) return
            await current(context, () => dispatch(index + 1))
        }

        await dispatch(0)
        return context
    }
}

export function authenticationMiddleware(secret) {
    if (typeof secret !== 'string' || secret.length < 32) {
        throw new Error('Authentication middleware requires a secret with at least 32 characters')
    }

    return async (context, next) => {
        verifyMessageAuthentication(context.message, secret)
        context.authenticated = true
        await next()
    }
}

export function replayProtectionMiddleware(protector) {
    if (!protector || typeof protector.assertFresh !== 'function') {
        throw new Error('Replay protection middleware requires a protector')
    }

    return async (context, next) => {
        protector.assertFresh(context.message)
        context.replayChecked = true
        await next()
    }
}

export function topicValidationMiddleware(registry) {
    if (!registry || typeof registry.validate !== 'function') {
        throw new Error('Topic validation middleware requires a schema registry')
    }

    return async (context, next) => {
        registry.validate(context.message)
        context.schemaValidated = true
        await next()
    }
}

export function rateLimitMiddleware(limiter, options = {}) {
    if (!limiter || (typeof limiter.consume !== 'function' && typeof limiter.consumeMessage !== 'function')) {
        throw new Error('Rate limit middleware requires a limiter')
    }

    return async (context, next) => {
        try {
            context.rateLimit = typeof limiter.consumeMessage === 'function'
                ? limiter.consumeMessage(context.message)
                : limiter.consume(messageRateLimitKey(context.message))
        } catch (error) {
            if (error.code === 'RATE_LIMITED') options.onRateLimited?.(context, error)
            throw error
        }
        await next()
    }
}

export function createInboundSecurityMiddleware(options) {
    if (!options || typeof options !== 'object') {
        throw new Error('Inbound security middleware options are required')
    }

    const middleware = [authenticationMiddleware(options.secret)]
    if (options.topicSchemas) middleware.push(topicValidationMiddleware(options.topicSchemas))
    middleware.push(
        replayProtectionMiddleware(options.replayProtector),
        rateLimitMiddleware(options.rateLimiter, { onRateLimited: options.onRateLimited })
    )
    return composeMessageMiddleware(middleware)
}
