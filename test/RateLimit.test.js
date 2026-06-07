import { expect } from "chai";
import {
    createRateLimiter,
    loadRateLimitConfig,
    messageRateLimitKey,
    RateLimitError,
} from "../agents/rate-limit.js";

describe("Network message rate limiting", function () {
    it("rejects traffic above capacity and reports retry timing", function () {
        let now = 1000;
        const limiter = createRateLimiter({
            capacity: 2,
            refillPerSecond: 1,
            idleTtlMs: 10_000,
            maxBuckets: 10,
            clock: () => now,
        });

        expect(limiter.consume("monitor:heartbeat").remaining).to.equal(1);
        expect(limiter.consume("monitor:heartbeat").remaining).to.equal(0);

        let error;
        try {
            limiter.consume("monitor:heartbeat");
        } catch (caught) {
            error = caught;
        }
        expect(error).to.be.instanceOf(RateLimitError);
        expect(error.code).to.equal("RATE_LIMITED");
        expect(error.retryAfterMs).to.equal(1000);

        now += 1000;
        expect(limiter.consume("monitor:heartbeat").remaining).to.equal(0);
    });

    it("isolates sender/topic buckets and bounds retained state", function () {
        let now = 0;
        const limiter = createRateLimiter({
            capacity: 1,
            refillPerSecond: 1,
            idleTtlMs: 100,
            maxBuckets: 2,
            clock: () => now,
        });

        limiter.consume("monitor:heartbeat");
        limiter.consume("monitor:alert");
        expect(limiter.size).to.equal(2);

        now = 1;
        limiter.consume("report:heartbeat");
        expect(limiter.size).to.equal(2);

        now = 200;
        limiter.consume("analytics:task");
        expect(limiter.size).to.equal(1);
    });

    it("loads validated environment configuration", function () {
        expect(loadRateLimitConfig({
            NETWORK_RATE_LIMIT_CAPACITY: "50",
            NETWORK_RATE_LIMIT_REFILL_PER_SECOND: "2.5",
            NETWORK_RATE_LIMIT_IDLE_TTL_MS: "60000",
            NETWORK_RATE_LIMIT_MAX_BUCKETS: "500",
        })).to.deep.equal({
            capacity: 50,
            refillPerSecond: 2.5,
            idleTtlMs: 60000,
            maxBuckets: 500,
        });

        expect(() => loadRateLimitConfig({ NETWORK_RATE_LIMIT_CAPACITY: "0" }))
            .to.throw("NETWORK_RATE_LIMIT_CAPACITY must be a positive integer");
    });

    it("builds stable sender/topic keys", function () {
        expect(messageRateLimitKey({ from: "monitor", topic: "heartbeat" }))
            .to.equal("monitor:heartbeat");
    });

    it("rejects costs that can never fit in a bucket", function () {
        const limiter = createRateLimiter({ capacity: 2 });
        expect(() => limiter.consume("monitor:heartbeat", 3))
            .to.throw("Rate limit cost must not exceed capacity");
    });
});
