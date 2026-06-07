import { expect } from "chai";
import {
    createMessageRateLimiter,
    createMessageRateLimitPolicy,
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
            NETWORK_RATE_LIMIT_GLOBAL_CAPACITY: "1000",
            NETWORK_RATE_LIMIT_GLOBAL_REFILL_PER_SECOND: "50",
            NETWORK_RATE_LIMIT_SENDER_CAPACITY: "200",
            NETWORK_RATE_LIMIT_SENDER_REFILL_PER_SECOND: "10",
        })).to.deep.equal({
            capacity: 50,
            refillPerSecond: 2.5,
            idleTtlMs: 60000,
            maxBuckets: 500,
            globalCapacity: 1000,
            globalRefillPerSecond: 50,
            senderCapacity: 200,
            senderRefillPerSecond: 10,
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

    it("exposes bounded-state statistics and bucket controls", function () {
        const limiter = createRateLimiter({
            capacity: 2,
            refillPerSecond: 1,
            idleTtlMs: 10,
            maxBuckets: 1,
            clock: () => 0,
        });

        limiter.consume("first");
        expect(limiter.inspect("first")).to.include({ remaining: 1, limit: 2 });
        limiter.consume("second");
        expect(limiter.stats()).to.include({ allowed: 2, evicted: 1, buckets: 1 });
        expect(limiter.reset("second")).to.equal(true);
        expect(limiter.size).to.equal(0);
        limiter.consume("third");
        expect(limiter.reset()).to.equal(true);
        expect(limiter.size).to.equal(0);
    });

    it("enforces global, sender, and sender/topic quotas", function () {
        const limiter = createMessageRateLimiter({
            capacity: 1,
            refillPerSecond: 1,
            globalCapacity: 4,
            globalRefillPerSecond: 1,
            senderCapacity: 2,
            senderRefillPerSecond: 1,
            idleTtlMs: 1000,
            maxBuckets: 10,
            clock: () => 0,
        });

        limiter.consumeMessage({ from: "monitor", topic: "heartbeat" });
        let topicError;
        try {
            limiter.consumeMessage({ from: "monitor", topic: "heartbeat" });
        } catch (error) {
            topicError = error;
        }
        expect(topicError).to.include({ code: "RATE_LIMITED", scope: "sender_topic" });

        limiter.consumeMessage({ from: "monitor", topic: "alert" });
        let senderError;
        try {
            limiter.consumeMessage({ from: "monitor", topic: "task" });
        } catch (error) {
            senderError = error;
        }
        expect(senderError).to.include({ code: "RATE_LIMITED", scope: "sender" });
        expect(limiter.stats().topics.allowed).to.equal(2);
        limiter.reset();
        expect(limiter.stats().topics.buckets).to.equal(0);
    });

    it("supports weighted topics and explicit sender exemptions", function () {
        const policy = createMessageRateLimitPolicy({
            defaultCost: 1,
            maxCost: 5,
            topicCosts: { "agent-tasks": 3 },
            exemptSenders: ["control-plane"],
        });
        const limiter = createMessageRateLimiter({
            capacity: 3,
            refillPerSecond: 1,
            globalCapacity: 10,
            globalRefillPerSecond: 1,
            senderCapacity: 10,
            senderRefillPerSecond: 1,
            policy,
            clock: () => 0,
        });

        expect(limiter.consumeMessage({ from: "deploy", topic: "agent-tasks" }).remaining).to.equal(0);
        expect(() => limiter.consumeMessage({ from: "deploy", topic: "agent-tasks" }))
            .to.throw().with.property("scope", "sender_topic");
        expect(limiter.consumeMessage({ from: "control-plane", topic: "agent-tasks" }))
            .to.include({ allowed: true, exempt: true });
    });

    it("validates weighted policy definitions", function () {
        expect(() => createMessageRateLimitPolicy({
            maxCost: 2,
            topicCosts: { task: 3 },
        })).to.throw("must not exceed maxCost");
        expect(() => createMessageRateLimitPolicy({ exemptSenders: [""] }))
            .to.throw("must be non-empty strings");
    });

    it("blocks distributed senders at the global quota", function () {
        const limiter = createMessageRateLimiter({
            capacity: 10,
            refillPerSecond: 1,
            globalCapacity: 2,
            globalRefillPerSecond: 1,
            senderCapacity: 10,
            senderRefillPerSecond: 1,
            clock: () => 0,
        });

        limiter.consumeMessage({ from: "deploy", topic: "heartbeat" });
        limiter.consumeMessage({ from: "monitor", topic: "heartbeat" });

        let error;
        try {
            limiter.consumeMessage({ from: "analytics", topic: "heartbeat" });
        } catch (caught) {
            error = caught;
        }
        expect(error).to.include({ code: "RATE_LIMITED", scope: "global" });
        expect(limiter.stats().global).to.include({ allowed: 2, rejected: 1 });
    });

    it("refunds broader quotas when a narrower quota rejects", function () {
        const limiter = createMessageRateLimiter({
            capacity: 1,
            refillPerSecond: 1,
            globalCapacity: 10,
            globalRefillPerSecond: 1,
            senderCapacity: 10,
            senderRefillPerSecond: 1,
            clock: () => 0,
        });

        const message = { from: "monitor", topic: "heartbeat" };
        limiter.consumeMessage(message);
        expect(() => limiter.consumeMessage(message)).to.throw();

        const stats = limiter.stats();
        expect(stats.global).to.include({ allowed: 2, refunded: 1 });
        expect(stats.senders).to.include({ allowed: 2, refunded: 1 });
        expect(stats.topics).to.include({ allowed: 1, rejected: 1 });
        expect(stats.topics.refunded).to.equal(0);
    });
});
