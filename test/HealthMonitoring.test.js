import { expect } from "chai";
import { startHealthServer } from "../agents/health.js";
import { createMetricsRegistry } from "../agents/metrics.js";

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
});
