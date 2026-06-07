import { expect } from "chai";
import {
    composeMessageMiddleware,
    createInboundSecurityMiddleware,
} from "../agents/message-middleware.js";
import { createAuthenticatedEnvelope } from "../agents/message-auth.js";
import { createRateLimiter } from "../agents/rate-limit.js";

describe("Inbound authentication middleware", function () {
    const secret = "test-only-network-auth-secret-with-32-characters";
    const authConfig = { secret, maxClockSkewMs: 1000, replayTtlMs: 5000 };

    function createSecurity(overrides = {}) {
        const seen = new Set();
        return createInboundSecurityMiddleware({
            secret,
            replayProtector: {
                assertFresh(message) {
                    if (seen.has(message.id)) throw new Error("Replay attack detected");
                    seen.add(message.id);
                },
            },
            rateLimiter: createRateLimiter({
                capacity: 2,
                refillPerSecond: 1,
                idleTtlMs: 1000,
                maxBuckets: 10,
            }),
            ...overrides,
        });
    }

    function message(id = "11111111-1111-4111-8111-111111111111") {
        return createAuthenticatedEnvelope("heartbeat", { status: "active" }, "monitor", {
            config: authConfig,
            id,
            timestamp: Date.now(),
        });
    }

    it("runs authentication, replay, and rate limiting in order", async function () {
        const context = { message: message() };
        await createSecurity()(context);

        expect(context.authenticated).to.equal(true);
        expect(context.replayChecked).to.equal(true);
        expect(context.rateLimit).to.include({ allowed: true, remaining: 1 });
    });

    it("rejects forged messages before replay and rate-limit state changes", async function () {
        let replayChecks = 0;
        let rateLimitChecks = 0;
        const security = createSecurity({
            replayProtector: { assertFresh: () => { replayChecks++; } },
            rateLimiter: { consume: () => { rateLimitChecks++; } },
        });
        const forged = { ...message(), data: { status: "forged" } };

        await expect(security({ message: forged })).to.be.rejectedWith("authentication failed");
        expect(replayChecks).to.equal(0);
        expect(rateLimitChecks).to.equal(0);
    });

    it("rejects replayed messages before rate limiting", async function () {
        let rateLimitChecks = 0;
        const security = createSecurity({
            rateLimiter: {
                consume() {
                    rateLimitChecks++;
                    return { allowed: true, remaining: 1 };
                },
            },
        });
        const envelope = message();

        await security({ message: envelope });
        await expect(security({ message: envelope })).to.be.rejectedWith("Replay attack detected");
        expect(rateLimitChecks).to.equal(1);
    });

    it("prevents middleware from invoking next more than once", async function () {
        const pipeline = composeMessageMiddleware([
            async (_context, next) => {
                await next();
                await next();
            },
        ]);
        await expect(pipeline({})).to.be.rejectedWith("next() called more than once");
    });
});
