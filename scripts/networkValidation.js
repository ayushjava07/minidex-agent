export function validateNetworkRun({ roles, statuses, broadcasts, deliveries }) {
    const errors = []
    const expectedPeerCount = roles.length - 1

    for (const status of statuses) {
        if (status.peers !== expectedPeerCount) {
            errors.push(`${status.role} connected to ${status.peers}/${expectedPeerCount} peers`)
        }
    }

    for (const broadcast of broadcasts) {
        const label = `${broadcast.sender} ${broadcast.topic}`
        if (broadcast.result.sent !== expectedPeerCount || broadcast.result.total !== expectedPeerCount) {
            errors.push(
                `${label} sent to ${broadcast.result.sent}/${broadcast.result.total} peers; expected ${expectedPeerCount}/${expectedPeerCount}`
            )
        }

        const recipients = new Set(
            deliveries
                .filter(delivery => delivery.sender === broadcast.sender && delivery.topic === broadcast.topic)
                .map(delivery => delivery.recipient)
        )
        const missing = roles.filter(role => role !== broadcast.sender && !recipients.has(role))
        if (missing.length > 0) {
            errors.push(`${label} was not delivered to: ${missing.join(', ')}`)
        }
    }

    if (errors.length > 0) {
        throw new Error(`Network integration failed:\n- ${errors.join('\n- ')}`)
    }
}
