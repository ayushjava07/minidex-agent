const TOPIC_PATTERN = /^[a-z][a-z0-9-]{0,63}$/
const SENDER_PATTERN = /^[a-zA-Z0-9:_-]{1,128}$/
const MAX_DEPTH = 8
const MAX_NODES = 1000
const MAX_STRING_LENGTH = 8192

function requirePositiveInteger(value, name) {
    if (!Number.isInteger(value) || value < 1) {
        throw new Error(`${name} must be a positive integer`)
    }
    return value
}

function assertSafeJson(value, depth = 0, state = { nodes: 0 }) {
    state.nodes++
    if (state.nodes > MAX_NODES) throw new Error('Message data exceeds maximum complexity')
    if (depth > MAX_DEPTH) throw new Error('Message data exceeds maximum depth')

    if (value === null || typeof value === 'boolean' || typeof value === 'number') return
    if (typeof value === 'string') {
        if (value.length > MAX_STRING_LENGTH) throw new Error('Message string exceeds maximum length')
        return
    }
    if (Array.isArray(value)) {
        for (const item of value) assertSafeJson(item, depth + 1, state)
        return
    }
    if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
        throw new Error('Message data must contain only JSON values')
    }

    for (const [key, item] of Object.entries(value)) {
        if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
            throw new Error(`Message data contains forbidden key: ${key}`)
        }
        assertSafeJson(item, depth + 1, state)
    }
}

export function loadMessageValidationConfig(env = process.env) {
    return Object.freeze({
        maxMessageBytes: requirePositiveInteger(
            Number(env.NETWORK_MAX_MESSAGE_BYTES || 65536),
            'NETWORK_MAX_MESSAGE_BYTES'
        )
    })
}

export function createMessageEnvelope(topic, data, from, timestamp = Date.now()) {
    const envelope = { topic, data, from, ts: timestamp }
    validateMessageEnvelope(envelope)
    return envelope
}

export function validateMessageTopic(topic) {
    if (!TOPIC_PATTERN.test(topic || '')) {
        throw new Error('Message topic must be a lowercase alphanumeric identifier')
    }
    return topic
}

export function validateMessageEnvelope(message) {
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
        throw new Error('Message envelope must be an object')
    }

    const keys = Object.keys(message)
    const allowedKeys = new Set(['topic', 'data', 'from', 'ts', 'id', 'auth'])
    const unexpected = keys.filter(key => !allowedKeys.has(key))
    if (unexpected.length > 0) {
        throw new Error(`Message envelope contains unexpected fields: ${unexpected.join(', ')}`)
    }
    validateMessageTopic(message.topic)
    if (!SENDER_PATTERN.test(message.from || '')) {
        throw new Error('Message sender has an invalid format')
    }
    if (!Number.isSafeInteger(message.ts) || message.ts < 0) {
        throw new Error('Message timestamp must be a non-negative safe integer')
    }
    if (message.id !== undefined && (typeof message.id !== 'string' || !/^[0-9a-f-]{36}$/.test(message.id))) {
        throw new Error('Message ID has an invalid format')
    }
    if (!message.data || typeof message.data !== 'object' || Array.isArray(message.data)) {
        throw new Error('Message data must be an object')
    }

    assertSafeJson(message.data)
    return message
}

export function parseMessage(raw, options = {}) {
    const maxMessageBytes = options.maxMessageBytes ?? loadMessageValidationConfig().maxMessageBytes
    if (Buffer.byteLength(raw, 'utf8') > maxMessageBytes) {
        throw new Error(`Message exceeds maximum size of ${maxMessageBytes} bytes`)
    }

    let message
    try {
        message = JSON.parse(raw)
    } catch {
        throw new Error('Message must contain valid JSON')
    }

    return validateMessageEnvelope(message)
}
