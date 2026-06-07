function requireNonNegativeInteger(value, name) {
    if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`)
    return value
}

function requireRatio(value, name) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new Error(`${name} must be a number between 0 and 1`)
    }
    return value
}

export class DeliveryPolicyError extends Error {
    constructor(message, result, policy) {
        super(message)
        this.name = 'DeliveryPolicyError'
        this.code = 'DELIVERY_POLICY_FAILED'
        this.result = Object.freeze({ ...result })
        this.policy = policy
    }
}

export function createDeliveryPolicy(options = {}) {
    const minRecipients = requireNonNegativeInteger(options.minRecipients ?? 0, 'minRecipients')
    const minSuccessRatio = requireRatio(options.minSuccessRatio ?? 0, 'minSuccessRatio')
    const requireAll = options.requireAll ?? false
    if (typeof requireAll !== 'boolean') throw new Error('requireAll must be a boolean')

    const policy = Object.freeze({ minRecipients, minSuccessRatio, requireAll })
    return Object.freeze({
        ...policy,
        assert(result) {
            if (!result || !Number.isInteger(result.sent) || !Number.isInteger(result.total)) {
                throw new Error('Delivery result must contain integer sent and total values')
            }
            if (result.sent < 0 || result.total < 0 || result.sent > result.total) {
                throw new Error('Delivery result contains invalid recipient counts')
            }
            if (result.sent < minRecipients) {
                throw new DeliveryPolicyError(
                    `Delivered to ${result.sent} recipients; policy requires at least ${minRecipients}`,
                    result,
                    policy
                )
            }
            const ratio = result.total === 0 ? 0 : result.sent / result.total
            if (ratio < minSuccessRatio) {
                throw new DeliveryPolicyError(
                    `Delivery success ratio ${ratio.toFixed(3)} is below required ${minSuccessRatio.toFixed(3)}`,
                    result,
                    policy
                )
            }
            if (requireAll && result.sent !== result.total) {
                throw new DeliveryPolicyError(
                    `Delivered to ${result.sent} of ${result.total} recipients; policy requires all recipients`,
                    result,
                    policy
                )
            }
            return result
        }
    })
}

export const bestEffortDelivery = createDeliveryPolicy()
