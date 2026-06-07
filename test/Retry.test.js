import { expect } from "chai";
import { loadRetryConfig, withRetry } from "../agents/retry.js";

describe("Retry and backoff", function () {
    it("retries transient failures with bounded exponential delays", async function () {
        const delays = [];
        let attempts = 0;

        const result = await withRetry(async () => {
            attempts++;
            if (attempts < 4) throw new Error("temporary");
            return "connected";
        }, {
            maxAttempts: 4,
            initialDelayMs: 100,
            maxDelayMs: 250,
            sleep: async delay => delays.push(delay)
        });

        expect(result).to.equal("connected");
        expect(delays).to.deep.equal([100, 200, 250]);
    });

    it("throws the final error after exhausting attempts", async function () {
        let attempts = 0;

        try {
            await withRetry(async () => {
                attempts++;
                throw new Error(`failure-${attempts}`);
            }, { maxAttempts: 2, initialDelayMs: 0 });
            expect.fail("Expected retry exhaustion");
        } catch (error) {
            expect(error.message).to.equal("failure-2");
            expect(attempts).to.equal(2);
        }
    });

    it("loads and validates network retry configuration", function () {
        expect(loadRetryConfig({
            NETWORK_RETRY_ATTEMPTS: "5",
            NETWORK_RETRY_DELAY_MS: "50",
            NETWORK_RETRY_MAX_DELAY_MS: "500"
        })).to.deep.equal({
            maxAttempts: 5,
            initialDelayMs: 50,
            maxDelayMs: 500
        });

        expect(() => loadRetryConfig({ NETWORK_RETRY_ATTEMPTS: "0" }))
            .to.throw("NETWORK_RETRY_ATTEMPTS must be a positive integer");
    });
});
