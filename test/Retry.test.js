import { expect } from "chai";
import {
    calculateRetryDelay,
    createRetryManager,
    isTransientNetworkError,
    loadRetryConfig,
    withRetry,
} from "../agents/retry.js";
import { CircuitOpenError, createCircuitBreaker } from "../agents/circuit-breaker.js";

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

    it("adds bounded jitter without exceeding configured variance", function () {
        expect(calculateRetryDelay(2, {
            initialDelayMs: 100,
            maxDelayMs: 1000,
            jitterRatio: 0.25,
            random: () => 0,
        })).to.equal(150);
        expect(calculateRetryDelay(2, {
            initialDelayMs: 100,
            maxDelayMs: 1000,
            jitterRatio: 0.25,
            random: () => 1,
        })).to.equal(250);
    });

    it("does not retry permanent failures", async function () {
        let attempts = 0;
        await expect(withRetry(async () => {
            attempts++;
            const error = new Error("authentication failed");
            throw error;
        }, {
            maxAttempts: 5,
            shouldRetry: isTransientNetworkError,
        })).to.be.rejectedWith("authentication failed");
        expect(attempts).to.equal(1);
    });

    it("supports cancellation during backoff", async function () {
        const controller = new AbortController();
        const retrying = withRetry(async () => {
            throw new Error("temporary");
        }, {
            maxAttempts: 5,
            initialDelayMs: 10_000,
            signal: controller.signal,
        });

        controller.abort("shutdown");
        await expect(retrying).to.be.rejectedWith("Retry aborted: shutdown");
    });

    it("tracks manager operation statistics", async function () {
        const manager = createRetryManager({ maxAttempts: 2, initialDelayMs: 0 });
        let attempts = 0;
        expect(await manager.execute(async () => {
            attempts++;
            if (attempts === 1) throw new Error("temporary");
            return "ok";
        })).to.equal("ok");

        expect(manager.stats()).to.deep.equal({
            operations: 1,
            retries: 1,
            successes: 1,
            failures: 0,
        });
    });

    it("opens a circuit after repeated failures and recovers through half-open", async function () {
        let now = 1000;
        const transitions = [];
        const breaker = createCircuitBreaker({
            failureThreshold: 2,
            resetTimeoutMs: 100,
            clock: () => now,
            onStateChange: snapshot => transitions.push(snapshot.state),
        });

        const fail = () => breaker.execute(async () => { throw new Error("down"); });
        await expect(fail()).to.be.rejectedWith("down");
        await expect(fail()).to.be.rejectedWith("down");

        let error;
        try {
            await breaker.execute(async () => "blocked");
        } catch (caught) {
            error = caught;
        }
        expect(error).to.be.instanceOf(CircuitOpenError);
        expect(error.retryAfterMs).to.equal(100);

        now += 100;
        expect(await breaker.execute(async () => "recovered")).to.equal("recovered");
        expect(breaker.snapshot().state).to.equal("closed");
        expect(transitions).to.deep.equal(["open", "half_open", "closed"]);
    });

    it("allows only one half-open probe at a time", async function () {
        let now = 0;
        let release;
        const breaker = createCircuitBreaker({
            failureThreshold: 1,
            resetTimeoutMs: 10,
            clock: () => now,
        });
        await expect(breaker.execute(async () => { throw new Error("down"); })).to.be.rejected;
        now = 10;
        const probe = breaker.execute(() => new Promise(resolve => { release = resolve; }));

        await expect(breaker.execute(async () => "second")).to.be.rejectedWith("Circuit breaker is open");
        release("first");
        expect(await probe).to.equal("first");
    });

    it("integrates circuit state with retry managers", async function () {
        const breaker = createCircuitBreaker({ failureThreshold: 1 });
        const manager = createRetryManager({
            maxAttempts: 1,
            circuitBreaker: breaker,
        });

        await expect(manager.execute(async () => { throw new Error("offline"); })).to.be.rejectedWith("offline");
        await expect(manager.execute(async () => "blocked")).to.be.rejectedWith("Circuit breaker is open");
        expect(manager.circuit().state).to.equal("open");
        expect(manager.stats()).to.include({ operations: 2, failures: 2 });
    });
});
