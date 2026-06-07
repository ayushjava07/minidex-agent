export function summarizeSwapEvents(events, tokenAAddress) {
    const normalizedTokenA = tokenAAddress.toLowerCase()

    return events.reduce((summary, event) => {
        summary.swapCount++

        if (event.args.tokenIn.toLowerCase() === normalizedTokenA) {
            summary.totalVolumeA += event.args.amountIn
        } else {
            summary.totalVolumeB += event.args.amountIn
        }

        return summary
    }, {
        swapCount: 0,
        totalVolumeA: 0n,
        totalVolumeB: 0n
    })
}
