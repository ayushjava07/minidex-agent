import { loadHealthMonitorConfig } from '../agents/health-monitor.js'
import { loadLoggerConfig } from '../agents/logger.js'
import { loadMessageAuthConfig } from '../agents/message-auth.js'
import { loadMessageValidationConfig } from '../agents/message-schema.js'
import { loadRateLimitConfig } from '../agents/rate-limit.js'
import { loadRetryConfig } from '../agents/retry.js'

function nonNegativeInteger(value, name) {
    if (!Number.isInteger(value) || value < 0) {
        throw new Error(`${name} must be a non-negative integer`)
    }
    return value
}

function loadHealthConfig(env) {
    return Object.freeze({
        minPeers: nonNegativeInteger(Number(env.HEALTH_MIN_PEERS || 1), 'HEALTH_MIN_PEERS'),
        ...loadHealthMonitorConfig(env)
    })
}

function capture(issues, name, loader) {
    try {
        return loader()
    } catch (error) {
        issues.push(Object.freeze({ section: name, message: error.message }))
        return undefined
    }
}

export class ConfigurationError extends Error {
    constructor(issues) {
        const detail = issues.map(issue => `[${issue.section}] ${issue.message}`).join('; ')
        super(`Runtime configuration is invalid: ${detail}`)
        this.name = 'ConfigurationError'
        this.code = 'INVALID_CONFIGURATION'
        this.issues = Object.freeze([...issues])
    }
}

export function loadRuntimeConfig(env = process.env) {
    const issues = []
    const logging = capture(issues, 'logging', () => loadLoggerConfig(env))
    const retry = capture(issues, 'retry', () => loadRetryConfig(env))
    const validation = capture(issues, 'message-validation', () => loadMessageValidationConfig(env))
    const authentication = capture(issues, 'message-authentication', () => loadMessageAuthConfig(env))
    const rateLimit = capture(issues, 'rate-limit', () => loadRateLimitConfig(env))
    const health = capture(issues, 'health', () => loadHealthConfig(env))

    if (retry && retry.initialDelayMs > retry.maxDelayMs) {
        issues.push(Object.freeze({
            section: 'retry',
            message: 'NETWORK_RETRY_DELAY_MS must not exceed NETWORK_RETRY_MAX_DELAY_MS'
        }))
    }
    if (authentication && authentication.replayTtlMs < authentication.maxClockSkewMs) {
        issues.push(Object.freeze({
            section: 'message-authentication',
            message: 'NETWORK_REPLAY_TTL_MS must be greater than or equal to NETWORK_MAX_CLOCK_SKEW_MS'
        }))
    }

    if (issues.length > 0) throw new ConfigurationError(issues)

    return Object.freeze({
        logging,
        health,
        network: Object.freeze({
            retry,
            validation,
            authentication,
            rateLimit
        })
    })
}

export function describeRuntimeConfig(config) {
    return Object.freeze({
        logging: config.logging,
        health: config.health,
        network: Object.freeze({
            retry: config.network.retry,
            validation: config.network.validation,
            authentication: Object.freeze({
                secret: '[redacted]',
                maxClockSkewMs: config.network.authentication.maxClockSkewMs,
                replayTtlMs: config.network.authentication.replayTtlMs
            }),
            rateLimit: config.network.rateLimit
        })
    })
}
