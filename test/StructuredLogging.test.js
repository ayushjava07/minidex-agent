import { expect } from "chai";
import { createLogger } from "../agents/logger.js";

describe("Structured logging", function () {
    const timestamp = new Date("2026-06-07T00:00:00.000Z");

    it("emits parseable JSON with standard fields", function () {
        const lines = [];
        const logger = createLogger("network", {
            sink: line => lines.push(line),
            clock: () => timestamp
        });

        logger.info("peer_connected", { role: "monitor", peers: 4 });

        expect(JSON.parse(lines[0])).to.deep.equal({
            timestamp: timestamp.toISOString(),
            level: "info",
            component: "network",
            event: "peer_connected",
            role: "monitor",
            peers: 4
        });
    });

    it("filters messages below the configured level", function () {
        const lines = [];
        const logger = createLogger("network", { level: "warn", sink: line => lines.push(line) });

        logger.info("ignored");
        logger.warn("included");

        expect(lines).to.have.length(1);
        expect(JSON.parse(lines[0]).event).to.equal("included");
    });

    it("serializes errors and bigint fields", function () {
        const lines = [];
        const logger = createLogger("analytics", { sink: line => lines.push(line) });

        logger.error("workflow_failed", { error: new Error("RPC unavailable"), amount: 10n });

        const entry = JSON.parse(lines[0]);
        expect(entry.error).to.include({ name: "Error", message: "RPC unavailable" });
        expect(entry.amount).to.equal("10");
    });

    it("rejects unsupported log levels", function () {
        expect(() => createLogger("network", { level: "verbose" }))
            .to.throw("LOG_LEVEL must be one of: debug, info, warn, error");
    });
});
