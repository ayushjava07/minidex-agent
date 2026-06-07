import { expect } from "chai";
import { summarizeSwapEvents } from "../agents/workflows/analytics.js";

describe("Agent workflows", function () {
    describe("analytics swap aggregation", function () {
        it("counts swaps and attributes input volume by token", function () {
            const tokenA = "0x0000000000000000000000000000000000000001";
            const tokenB = "0x0000000000000000000000000000000000000002";
            const events = [
                { args: { tokenIn: tokenA, amountIn: 10n } },
                { args: { tokenIn: tokenB, amountIn: 25n } },
                { args: { tokenIn: tokenA.toUpperCase(), amountIn: 5n } }
            ];

            expect(summarizeSwapEvents(events, tokenA)).to.deep.equal({
                swapCount: 3,
                totalVolumeA: 15n,
                totalVolumeB: 25n
            });
        });

        it("returns zero totals when no swaps were emitted", function () {
            const tokenA = "0x0000000000000000000000000000000000000001";

            expect(summarizeSwapEvents([], tokenA)).to.deep.equal({
                swapCount: 0,
                totalVolumeA: 0n,
                totalVolumeB: 0n
            });
        });
    });
});
