import { expect } from "chai";
import {
    ConfigurationError,
    describeRuntimeConfig,
    loadRuntimeConfig,
} from "../config/runtime.js";

describe("Runtime configuration validation", function () {
    const validEnv = {
        NETWORK_AUTH_SECRET: "test-only-network-auth-secret-with-32-characters",
    };

    it("loads an immutable validated runtime snapshot", function () {
        const config = loadRuntimeConfig(validEnv);

        expect(config.logging).to.deep.equal({ level: "info" });
        expect(config.health).to.deep.equal({ minPeers: 1, checkTimeoutMs: 2000 });
        expect(config.network.retry.maxAttempts).to.equal(3);
        expect(Object.isFrozen(config.network)).to.equal(true);
    });

    it("reports all invalid sections in one configuration error", function () {
        let error;
        try {
            loadRuntimeConfig({
                LOG_LEVEL: "verbose",
                NETWORK_AUTH_SECRET: "short",
                NETWORK_MAX_MESSAGE_BYTES: "0",
                NETWORK_RATE_LIMIT_CAPACITY: "-1",
                HEALTH_MIN_PEERS: "-1",
            });
        } catch (caught) {
            error = caught;
        }

        expect(error).to.be.instanceOf(ConfigurationError);
        expect(error.code).to.equal("INVALID_CONFIGURATION");
        expect(error.issues.map(issue => issue.section)).to.include.members([
            "logging",
            "message-validation",
            "message-authentication",
            "rate-limit",
            "health",
        ]);
    });

    it("enforces cross-field constraints", function () {
        expect(() => loadRuntimeConfig({
            ...validEnv,
            NETWORK_RETRY_DELAY_MS: "1000",
            NETWORK_RETRY_MAX_DELAY_MS: "100",
            NETWORK_MAX_CLOCK_SKEW_MS: "1000",
            NETWORK_REPLAY_TTL_MS: "500",
        })).to.throw("NETWORK_RETRY_DELAY_MS must not exceed");
    });

    it("redacts authentication secrets from diagnostics", function () {
        const config = loadRuntimeConfig(validEnv);
        const description = describeRuntimeConfig(config);
        expect(description.network.authentication.secret).to.equal("[redacted]");
        expect(JSON.stringify(description)).not.to.include(validEnv.NETWORK_AUTH_SECRET);
    });
});
