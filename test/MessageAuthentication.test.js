import { expect } from "chai";
import {
    createAuthenticatedEnvelope,
    createReplayProtector,
    loadMessageAuthConfig,
    verifyMessageAuthentication
} from "../agents/message-auth.js";

describe("Message authentication and replay protection", function () {
    const secret = "test-only-network-auth-secret-with-32-characters";
    const config = { secret, maxClockSkewMs: 1000, replayTtlMs: 5000 };

    it("authenticates untampered messages and rejects forged payloads", function () {
        const message = createAuthenticatedEnvelope("heartbeat", { status: "active" }, "monitor", {
            config,
            id: "11111111-1111-4111-8111-111111111111",
            timestamp: 1000
        });

        expect(() => verifyMessageAuthentication(message, secret)).not.to.throw();
        expect(() => verifyMessageAuthentication({
            ...message,
            data: { status: "compromised" }
        }, secret)).to.throw("Message authentication failed");
    });

    it("rejects replayed message IDs and stale timestamps", function () {
        let now = 1000;
        const protector = createReplayProtector({
            maxClockSkewMs: 100,
            replayTtlMs: 1000,
            clock: () => now
        });
        const message = createAuthenticatedEnvelope("heartbeat", { status: "active" }, "monitor", {
            config,
            id: "22222222-2222-4222-8222-222222222222",
            timestamp: now
        });

        protector.assertFresh(message);
        expect(() => protector.assertFresh(message)).to.throw("Replay attack detected");

        now = 5000;
        expect(() => protector.assertFresh({
            ...message,
            id: "33333333-3333-4333-8333-333333333333"
        })).to.throw("Message timestamp is outside the allowed clock skew");
    });

    it("requires a strong authentication secret", function () {
        expect(() => loadMessageAuthConfig({ NETWORK_AUTH_SECRET: "short" }))
            .to.throw("NETWORK_AUTH_SECRET must contain at least 32 characters");
    });
});
