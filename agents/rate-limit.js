const DEFAULT_CAPACITY = 120
const DEFAULT_REFILL_PER_SECOND = 2
const DEFAULT_IDLE_TTL_MS = 300_000
const DEFAULT_MAX_BUCKETS = 10_000

function requirePositiveNumber(value, name) {
    if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`${name} must be a positive number`)
    }
    return value
}

function requirePositiveInteger(value, name) {
    if (!Number.isInteger(value) || value < 1) {
        throw new Error(`${name} must be a positive integer`)
    }
    return value
}

export class RateLimitError extends Error {
    constructor(key, retryAfterMs) {
        super(`Rate limit exceeded for ${key}`)
        this.name = 'RateLimitError'
        this.code = 'RATE_LIMITED'
        this.retryAfterMs = retryAfterMs
    }
}

export function loadRateLimitConfig(env = process.env) {
    const capacity = requirePositiveInteger(
        Number(env.NETWORK_RATE_LIMIT_CAPACITY || DEFAULT_CAPACITY),
        'NETWORK_RATE_LIMIT_CAPACITY'
    )
    const refillPerSecond = requirePositiveNumber(
        Number(env.NETWORK_RATE_LIMIT_REFILL_PER_SECOND || DEFAULT_REFILL_PER_SECOND),
        'NETWORK_RATE_LIMIT_REFILL_PER_SECOND'
    )
    const idleTtlMs = requirePositiveInteger(
        Number(env.NETWORK_RATE_LIMIT_IDLE_TTL_MS || DEFAULT_IDLE_TTL_MS),
        'NETWORK_RATE_LIMIT_IDLE_TTL_MS'
    )
    const maxBuckets = requirePositiveInteger(
        Number(env.NETWORK_RATE_LIMIT_MAX_BUCKETS || DEFAULT_MAX_BUCKETS),
        'NETWORK_RATE_LIMIT_MAX_BUCKETS'
    )

    return Object.freeze({ capacity, refillPerSecond, idleTtlMs, maxBuckets })
}

export function createRateLimiter(options = {}) {
    const capacity = requirePositiveInteger(options.capacity ?? DEFAULT_CAPACITY, 'capacity')
    const refillPerSecond = requirePositiveNumber(
        options.refillPerSecond ?? DEFAULT_REFILL_PER_SECOND,
        'refillPerSecond'
    )
    const idleTtlMs = requirePositiveInteger(options.idleTtlMs ?? DEFAULT_IDLE_TTL_MS, 'idleTtlMs')
    const maxBuckets = requirePositiveInteger(options.maxBuckets ?? DEFAULT_MAX_BUCKETS, 'maxBuckets')
    const clock = options.clock ?? Date.now
    const buckets = new Map()

    function prune(now) {
        for (const [key, bucket] of buckets) {
            if (now - bucket.lastSeenAt >= idleTtlMs) buckets.delete(key)
        }
    }

    function evictOldest() {
        let oldestKey
        let oldestTime = Infinity
        for (const [key, bucket] of buckets) {
            if (bucket.lastSeenAt < oldestTime) {
                oldestKey = key
                oldestTime = bucket.lastSeenAt
            }
        }
        if (oldestKey !== undefined) buckets.delete(oldestKey)
    }

    function refill(bucket, now) {
        const elapsedMs = Math.max(0, now - bucket.refilledAt)
        bucket.tokens = Math.min(capacity, bucket.tokens + elapsedMs * refillPerSecond / 1000)
        bucket.refilledAt = now
        bucket.lastSeenAt = now
    }

    function consume(key, cost = 1) {
        if (typeof key !== 'string' || key.length === 0) {
            throw new Error('Rate limit key must be a non-empty string')
        }
        requirePositiveNumber(cost, 'Rate limit cost')
        if (cost > capacity) throw new Error('Rate limit cost must not exceed capacity')

        const now = clock()
        if (!Number.isFinite(now) || now < 0) throw new Error('Rate limit clock returned an invalid timestamp')
        prune(now)

        let bucket = buckets.get(key)
        if (!bucket) {
            if (buckets.size >= maxBuckets) evictOldest()
            bucket = { tokens: capacity, refilledAt: now, lastSeenAt: now }
            buckets.set(key, bucket)
        } else {
            refill(bucket, now)
        }

        if (bucket.tokens < cost) {
            const missingTokens = cost - bucket.tokens
            throw new RateLimitError(key, Math.ceil(missingTokens / refillPerSecond * 1000))
        }

        bucket.tokens -= cost
        return Object.freeze({
            allowed: true,
            remaining: Math.floor(bucket.tokens),
            limit: capacity
        })
    }

    return Object.freeze({
        consume,
        get size() {
            return buckets.size
        }
    })
}

export function messageRateLimitKey(message) {
    return `${message.from}:${message.topic}`
}
