import { expect } from "chai";
import { startHealthServer } from "../agents/health.js";
import { createMetricsRegistry } from "../agents/metrics.js";
import { createHealthMonitor, loadHealthMonitorConfig } from "../agents/health-monitor.js";

describe("Agent health monitoring", function () {
    function createNode(connections) {
        return {
            role: "monitor",
            getConnections: () => connections
        };
    }

    it("reports liveness and readiness from current peer connectivity", async function () {
        const connections = [];
        const server = await startHealthServer(createNode(connections), { port: 0, minPeers: 1 });
        const { port } = server.address();

        try {
            const live = await fetch(`http://127.0.0.1:${port}/health/live`);
            expect(live.status).to.equal(200);
            expect(await live.json()).to.include({ status: "ok", role: "monitor", peers: 0 });

            const notReady = await fetch(`http://127.0.0.1:${port}/health/ready`);
            expect(notReady.status).to.equal(503);

            connections.push({ remotePeer: { toString: () => "peer-1" } });
            const ready = await fetch(`http://127.0.0.1:${port}/health/ready`);
            expect(ready.status).to.equal(200);
            expect(await ready.json()).to.include({ status: "ready", peers: 1 });
        } finally {
            await server.stop();
        }
    });

    it("rejects invalid readiness configuration", async function () {
        await expect(startHealthServer(createNode([]), { port: 0, minPeers: -1 }))
            .to.be.rejectedWith("HEALTH_MIN_PEERS must be a non-negative integer");
        await expect(startHealthServer(createNode([]), {
            port: 0,
            minPeers: 0,
            env: { HEALTH_HOST: " " },
        })).to.be.rejectedWith("HEALTH_HOST must be a non-empty string");
    });

    it("uses the configured health host", async function () {
        const server = await startHealthServer(createNode([]), {
            port: 0,
            minPeers: 0,
            env: { HEALTH_HOST: " 127.0.0.1 " },
        });

        try {
            expect(server.address().address).to.equal("127.0.0.1");
        } finally {
            await server.stop();
        }
    });

    it("exposes Prometheus metrics", async function () {
        const metrics = createMetricsRegistry();
        const counter = metrics.counter("health_requests_total", "Health requests.");
        counter.inc();
        const server = await startHealthServer(createNode([]), { port: 0, minPeers: 0, metrics });
        const { port } = server.address();

        try {
            const response = await fetch(`http://127.0.0.1:${port}/metrics`);
            expect(response.status).to.equal(200);
            expect(response.headers.get("content-type")).to.include("text/plain");
            expect(await response.text()).to.include("health_requests_total 1");
        } finally {
            await server.stop();
        }
    });

    it("reports critical dependency failures and optional degradation", async function () {
        const server = await startHealthServer(createNode([]), {
            port: 0,
            minPeers: 0,
            checks: [
                { name: "cache", critical: false, check: () => false },
                { name: "rpc", check: () => { throw new Error("RPC unavailable"); } },
            ],
        });
        const { port } = server.address();

        try {
            const response = await fetch(`http://127.0.0.1:${port}/health/ready`);
            const body = await response.json();
            expect(response.status).to.equal(503);
            expect(body.status).to.equal("not_ready");
            const rpcCheck = body.checks.find(check => check.name === "rpc");
            expect(rpcCheck).to.include({
                status: "fail",
                critical: true,
                error: "RPC unavailable",
            });
            expect(rpcCheck.latencyMs).to.be.at.least(0);
        } finally {
            await server.stop();
        }
    });

    it("supports runtime checks and degraded readiness", async function () {
        const server = await startHealthServer(createNode([]), { port: 0, minPeers: 0 });
        server.registerCheck({ name: "reporter", critical: false, check: () => false });

        try {
            const result = await server.check();
            expect(result.ready).to.equal(true);
            expect(result.status).to.equal("degraded");
        } finally {
            await server.stop();
        }
    });

    it("times out checks and validates health configuration", async function () {
        const monitor = createHealthMonitor({
            checkTimeoutMs: 5,
            checks: [{ name: "stalled", check: () => new Promise(() => {}) }],
        });
        const result = await monitor.evaluate();
        expect(result.status).to.equal("not_ready");
        expect(result.checks[0].error).to.include("timed out");

        expect(loadHealthMonitorConfig({ HEALTH_CHECK_TIMEOUT_MS: "250" }))
            .to.deep.equal({ checkTimeoutMs: 250 });
        expect(() => loadHealthMonitorConfig({ HEALTH_CHECK_TIMEOUT_MS: "0" }))
            .to.throw("HEALTH_CHECK_TIMEOUT_MS must be a positive integer");
        expect(() => createHealthMonitor({
            checks: [{ name: "rpc", critical: "yes", check: () => true }],
        })).to.throw('Health check "rpc" critical must be a boolean');
    });
});
