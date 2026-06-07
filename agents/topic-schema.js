const TOPIC_PATTERN = /^[a-z][a-z0-9-]{0,63}$/
const SUPPORTED_TYPES = new Set(['object', 'array', 'string', 'number', 'integer', 'boolean', 'null'])

function valueType(value) {
    if (value === null) return 'null'
    if (Array.isArray(value)) return 'array'
    if (Number.isInteger(value)) return 'integer'
    return typeof value
}

function fail(path, message) {
    throw new Error(`Topic message schema validation failed at ${path}: ${message}`)
}

function validateSchemaDefinition(schema, path = '$') {
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
        throw new Error(`Schema at ${path} must be an object`)
    }
    if (schema.type !== undefined && !SUPPORTED_TYPES.has(schema.type)) {
        throw new Error(`Schema at ${path} has unsupported type: ${schema.type}`)
    }
    if (schema.required !== undefined && (!Array.isArray(schema.required)
        || schema.required.some(name => typeof name !== 'string'))) {
        throw new Error(`Schema at ${path} required must be an array of strings`)
    }
    if (schema.properties !== undefined) {
        if (!schema.properties || typeof schema.properties !== 'object' || Array.isArray(schema.properties)) {
            throw new Error(`Schema at ${path} properties must be an object`)
        }
        for (const [name, child] of Object.entries(schema.properties)) {
            validateSchemaDefinition(child, `${path}.properties.${name}`)
        }
    }
    if (schema.items !== undefined) validateSchemaDefinition(schema.items, `${path}.items`)
}

function validateValue(value, schema, path) {
    const actualType = valueType(value)
    if (schema.type !== undefined) {
        const compatible = schema.type === actualType || (schema.type === 'number' && actualType === 'integer')
        if (!compatible) fail(path, `expected ${schema.type}, received ${actualType}`)
    }
    if (schema.enum !== undefined && !schema.enum.some(entry => Object.is(entry, value))) {
        fail(path, `must be one of: ${schema.enum.join(', ')}`)
    }

    if (typeof value === 'string') {
        if (schema.minLength !== undefined && value.length < schema.minLength) {
            fail(path, `must contain at least ${schema.minLength} characters`)
        }
        if (schema.maxLength !== undefined && value.length > schema.maxLength) {
            fail(path, `must contain at most ${schema.maxLength} characters`)
        }
        if (schema.pattern !== undefined && !(new RegExp(schema.pattern).test(value))) {
            fail(path, `must match ${schema.pattern}`)
        }
    }

    if (typeof value === 'number') {
        if (schema.minimum !== undefined && value < schema.minimum) fail(path, `must be at least ${schema.minimum}`)
        if (schema.maximum !== undefined && value > schema.maximum) fail(path, `must be at most ${schema.maximum}`)
    }

    if (Array.isArray(value)) {
        if (schema.minItems !== undefined && value.length < schema.minItems) fail(path, 'contains too few items')
        if (schema.maxItems !== undefined && value.length > schema.maxItems) fail(path, 'contains too many items')
        if (schema.items) value.forEach((item, index) => validateValue(item, schema.items, `${path}[${index}]`))
    }

    if (actualType === 'object') {
        const properties = schema.properties ?? {}
        for (const required of schema.required ?? []) {
            if (!Object.hasOwn(value, required)) fail(path, `missing required property "${required}"`)
        }
        for (const [name, item] of Object.entries(value)) {
            if (properties[name]) {
                validateValue(item, properties[name], `${path}.${name}`)
            } else if (schema.additionalProperties === false) {
                fail(path, `unexpected property "${name}"`)
            }
        }
        const count = Object.keys(value).length
        if (schema.maxProperties !== undefined && count > schema.maxProperties) fail(path, 'contains too many properties')
    }
}

export function createSchemaValidator(schema) {
    validateSchemaDefinition(schema)
    return value => {
        validateValue(value, schema, '$.data')
        return value
    }
}

export function createTopicSchemaRegistry(options = {}) {
    const allowUnknownTopics = options.allowUnknownTopics ?? true
    const validators = new Map()

    function register(topic, schemaOrValidator) {
        if (typeof topic !== 'string' || !TOPIC_PATTERN.test(topic)) {
            throw new Error(`Invalid schema topic: ${topic}`)
        }
        if (validators.has(topic)) throw new Error(`Topic schema already registered: ${topic}`)
        const validator = typeof schemaOrValidator === 'function'
            ? schemaOrValidator
            : createSchemaValidator(schemaOrValidator)
        validators.set(topic, validator)
        return validator
    }

    function validate(message) {
        const validator = validators.get(message.topic)
        if (!validator) {
            if (!allowUnknownTopics) throw new Error(`No message schema registered for topic: ${message.topic}`)
            return message
        }
        validator(message.data)
        return message
    }

    return Object.freeze({
        register,
        validate,
        has: topic => validators.has(topic),
        get size() {
            return validators.size
        }
    })
}

const timestamp = Object.freeze({ type: 'string', minLength: 1, maxLength: 64 })
const numericTimestamp = Object.freeze({ type: 'integer', minimum: 0 })
const sender = Object.freeze({ type: 'string', minLength: 1, maxLength: 128 })
const typeName = Object.freeze({ type: 'string', minLength: 1, maxLength: 64, pattern: '^[A-Z][A-Z0-9_]*$' })

export const topicSchemas = createTopicSchemaRegistry()

topicSchemas.register('heartbeat', {
    type: 'object',
    maxProperties: 16,
    properties: {
        agent: sender,
        from: sender,
        status: { type: 'string', minLength: 1, maxLength: 32 },
        msg: { type: 'string', minLength: 1, maxLength: 1024 },
        timestamp,
        ts: numericTimestamp
    }
})
topicSchemas.register('alert', {
    type: 'object',
    required: ['message'],
    maxProperties: 16,
    properties: {
        from: sender,
        message: { type: 'string', minLength: 1, maxLength: 2048 },
        severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        ts: numericTimestamp
    }
})
topicSchemas.register('alerts', {
    type: 'object',
    required: ['type'],
    maxProperties: 32,
    properties: { type: typeName, timestamp: {} }
})
topicSchemas.register('task', {
    type: 'object',
    required: ['action'],
    maxProperties: 24,
    properties: {
        from: sender,
        action: { type: 'string', minLength: 1, maxLength: 128 },
        assignedTo: sender,
        ts: numericTimestamp
    }
})
topicSchemas.register('agent-tasks', {
    type: 'object',
    required: ['type'],
    maxProperties: 64,
    properties: { type: typeName, from: sender, timestamp: {} }
})
