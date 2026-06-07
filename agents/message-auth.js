import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { createMessageEnvelope } from './message-schema.js'

const DEFAULT_MAX_CLOCK_SKEW_MS = 60_000
const DEFAULT_REPLAY_TTL_MS = 300_000

function requirePositiveInteger(value, name) {
    if (!Number.isInteger(value) || value < 1) {
        throw new Error(`${name} must be a positive integer`)
    }
    return value
}

export function loadMessageAuthConfig(env = process.env) {
    const secret = env.NETWORK_AUTH_SECRET?.trim()
    if (!secret || secret.length < 32) {
        throw new Error('NETWORK_AUTH_SECRET must contain at least 32 characters')
    }

    return Object.freeze({
        secret,
        maxClockSkewMs: requirePositiveInteger(
            Number(env.NETWORK_MAX_CLOCK_SKEW_MS || DEFAULT_MAX_CLOCK_SKEW_MS),
            'NETWORK_MAX_CLOCK_SKEW_MS'
        ),
        replayTtlMs: requirePositiveInteger(
            Number(env.NETWORK_REPLAY_TTL_MS || DEFAULT_REPLAY_TTL_MS),
            'NETWORK_REPLAY_TTL_MS'
        )
    })
}

function authenticationPayload(message) {
    return JSON.stringify({
        topic: message.topic,
        data: message.data,
        from: message.from,
        ts: message.ts,
        id: message.id
    })
}

export function signMessage(message, secret) {
    return createHmac('sha256', secret)
        .update(authenticationPayload(message))
        .digest('hex')
}

export function createAuthenticatedEnvelope(topic, data, from, options = {}) {
    const config = options.config ?? loadMessageAuthConfig()
    const envelope = {
        ...createMessageEnvelope(topic, data, from, options.timestamp ?? Date.now()),
        id: options.id ?? randomUUID()
    }

    return Object.freeze({
        ...envelope,
        auth: signMessage(envelope, config.secret)
    })
}

export function verifyMessageAuthentication(message, secret) {
    if (typeof message.auth !== 'string' || !/^[0-9a-f]{64}$/.test(message.auth)) {
        throw new Error('Message authentication tag has an invalid format')
    }

    const expected = Buffer.from(signMessage(message, secret), 'hex')
    const actual = Buffer.from(message.auth, 'hex')
    if (!timingSafeEqual(expected, actual)) {
        throw new Error('Message authentication failed')
    }
}

export function createReplayProtector(options = {}) {
    const maxClockSkewMs = options.maxClockSkewMs ?? DEFAULT_MAX_CLOCK_SKEW_MS
    const replayTtlMs = options.replayTtlMs ?? DEFAULT_REPLAY_TTL_MS
    const clock = options.clock ?? Date.now
    const seen = new Map()

    return Object.freeze({
        assertFresh(message) {
            const now = clock()
            if (Math.abs(now - message.ts) > maxClockSkewMs) {
                throw new Error('Message timestamp is outside the allowed clock skew')
            }

            for (const [id, expiresAt] of seen) {
                if (expiresAt <= now) seen.delete(id)
            }

            if (seen.has(message.id)) {
                throw new Error('Replay attack detected')
            }
            seen.set(message.id, now + replayTtlMs)
        }
    })
}
