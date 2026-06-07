const DEFAULT_CAPACITY = 120
const DEFAULT_REFILL_PER_SECOND = 2
const DEFAULT_IDLE_TTL_MS = 300_000
const DEFAULT_MAX_BUCKETS = 10_000
const DEFAULT_GLOBAL_MULTIPLIER = 20
const DEFAULT_SENDER_MULTIPLIER = 4

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
    constructor(key, retryAfterMs, scope = 'key') {
        super(`Rate limit exceeded for ${key}`)
        this.name = 'RateLimitError'
        this.code = 'RATE_LIMITED'
        this.retryAfterMs = retryAfterMs
        this.scope = scope
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

    return Object.freeze({
        capacity,
        refillPerSecond,
        idleTtlMs,
        maxBuckets,
        globalCapacity: requirePositiveInteger(
            Number(env.NETWORK_RATE_LIMIT_GLOBAL_CAPACITY || capacity * DEFAULT_GLOBAL_MULTIPLIER),
            'NETWORK_RATE_LIMIT_GLOBAL_CAPACITY'
        ),
        globalRefillPerSecond: requirePositiveNumber(
            Number(env.NETWORK_RATE_LIMIT_GLOBAL_REFILL_PER_SECOND || refillPerSecond * DEFAULT_GLOBAL_MULTIPLIER),
            'NETWORK_RATE_LIMIT_GLOBAL_REFILL_PER_SECOND'
        ),
        senderCapacity: requirePositiveInteger(
            Number(env.NETWORK_RATE_LIMIT_SENDER_CAPACITY || capacity * DEFAULT_SENDER_MULTIPLIER),
            'NETWORK_RATE_LIMIT_SENDER_CAPACITY'
        ),
        senderRefillPerSecond: requirePositiveNumber(
            Number(env.NETWORK_RATE_LIMIT_SENDER_REFILL_PER_SECOND || refillPerSecond * DEFAULT_SENDER_MULTIPLIER),
            'NETWORK_RATE_LIMIT_SENDER_REFILL_PER_SECOND'
        )
    })
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
    const stats = { allowed: 0, rejected: 0, refunded: 0, evicted: 0, pruned: 0 }

    function prune(now) {
        for (const [key, bucket] of buckets) {
            if (now - bucket.lastSeenAt >= idleTtlMs) {
                buckets.delete(key)
                stats.pruned++
            }
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
        if (oldestKey !== undefined) {
            buckets.delete(oldestKey)
            stats.evicted++
        }
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
            stats.rejected++
            throw new RateLimitError(key, Math.ceil(missingTokens / refillPerSecond * 1000))
        }

        bucket.tokens -= cost
        stats.allowed++
        return Object.freeze({
            allowed: true,
            remaining: Math.floor(bucket.tokens),
            limit: capacity
        })
    }

    return Object.freeze({
        consume,
        refund(key, amount = 1) {
            requirePositiveNumber(amount, 'Rate limit refund')
            const bucket = buckets.get(key)
            if (!bucket) return false
            refill(bucket, clock())
            bucket.tokens = Math.min(capacity, bucket.tokens + amount)
            stats.refunded++
            return true
        },
        inspect(key) {
            const bucket = buckets.get(key)
            if (!bucket) return undefined
            refill(bucket, clock())
            return Object.freeze({
                key,
                tokens: bucket.tokens,
                remaining: Math.floor(bucket.tokens),
                limit: capacity,
                lastSeenAt: bucket.lastSeenAt
            })
        },
        reset(key) {
            if (key !== undefined) return buckets.delete(key)
            buckets.clear()
            return true
        },
        stats: () => Object.freeze({ ...stats, buckets: buckets.size }),
        get size() {
            return buckets.size
        }
    })
}

export function messageRateLimitKey(message) {
    return `${message.from}:${message.topic}`
}

export function createMessageRateLimitPolicy(options = {}) {
    const defaultCost = requirePositiveNumber(options.defaultCost ?? 1, 'defaultCost')
    const maxCost = requirePositiveNumber(options.maxCost ?? 100, 'maxCost')
    if (defaultCost > maxCost) throw new Error('defaultCost must not exceed maxCost')

    const topicCosts = new Map()
    for (const [topic, cost] of Object.entries(options.topicCosts ?? {})) {
        if (!/^[a-z][a-z0-9-]{0,63}$/.test(topic)) throw new Error(`Invalid rate limit policy topic: ${topic}`)
        const validated = requirePositiveNumber(cost, `Rate limit cost for topic ${topic}`)
        if (validated > maxCost) throw new Error(`Rate limit cost for topic ${topic} must not exceed maxCost`)
        topicCosts.set(topic, validated)
    }

    const exemptSenders = new Set(options.exemptSenders ?? [])
    for (const sender of exemptSenders) {
        if (typeof sender !== 'string' || sender.length === 0) {
            throw new Error('Rate limit exempt senders must be non-empty strings')
        }
    }

    return Object.freeze({
        evaluate(message) {
            if (!message || typeof message.from !== 'string' || typeof message.topic !== 'string') {
                throw new Error('Rate limit policy requires a message with from and topic')
            }
            const exempt = exemptSenders.has(message.from)
            return Object.freeze({
                exempt,
                cost: exempt ? 0 : topicCosts.get(message.topic) ?? defaultCost
            })
        }
    })
}

export function createMessageRateLimiter(options = {}) {
    const shared = {
        idleTtlMs: options.idleTtlMs,
        maxBuckets: options.maxBuckets,
        clock: options.clock
    }
    const global = createRateLimiter({
        ...shared,
        capacity: options.globalCapacity ?? DEFAULT_CAPACITY * DEFAULT_GLOBAL_MULTIPLIER,
        refillPerSecond: options.globalRefillPerSecond ?? DEFAULT_REFILL_PER_SECOND * DEFAULT_GLOBAL_MULTIPLIER,
        maxBuckets: 1
    })
    const senders = createRateLimiter({
        ...shared,
        capacity: options.senderCapacity ?? DEFAULT_CAPACITY * DEFAULT_SENDER_MULTIPLIER,
        refillPerSecond: options.senderRefillPerSecond ?? DEFAULT_REFILL_PER_SECOND * DEFAULT_SENDER_MULTIPLIER
    })
    const topics = createRateLimiter(options)
    const policy = options.policy ?? createMessageRateLimitPolicy()
    if (!policy || typeof policy.evaluate !== 'function') {
        throw new Error('Message rate limiter policy must provide an evaluate function')
    }

    function consumeScope(limiter, key, scope, cost) {
        try {
            return limiter.consume(key, cost)
        } catch (error) {
            if (error.code === 'RATE_LIMITED') error.scope = scope
            throw error
        }
    }

    return Object.freeze({
        consumeMessage(message) {
            const decision = policy.evaluate(message)
            if (decision.exempt) {
                return Object.freeze({ allowed: true, exempt: true, remaining: Infinity, limit: Infinity })
            }
            const cost = requirePositiveNumber(decision.cost, 'Message rate limit policy cost')
            const topicKey = messageRateLimitKey(message)
            const consumed = []
            try {
                consumeScope(global, 'network', 'global', cost)
                consumed.push([global, 'network', cost])
                consumeScope(senders, message.from, 'sender', cost)
                consumed.push([senders, message.from, cost])
                return consumeScope(topics, topicKey, 'sender_topic', cost)
            } catch (error) {
                for (const [limiter, key, refund] of consumed.reverse()) limiter.refund(key, refund)
                throw error
            }
        },
        stats: () => Object.freeze({
            global: global.stats(),
            senders: senders.stats(),
            topics: topics.stats()
        }),
        reset() {
            global.reset()
            senders.reset()
            topics.reset()
        }
    })
}
