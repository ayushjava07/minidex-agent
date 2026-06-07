import { expect } from "chai";
import { startHealthServer } from "../agents/health.js";

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

    it("uses the configured health host", async function () {
        const previousHost = process.env.HEALTH_HOST;
        process.env.HEALTH_HOST = "127.0.0.1";

        try {
            const server = await startHealthServer(createNode([]), { port: 0, minPeers: 0 });
            expect(server.address().address).to.equal("127.0.0.1");
            await server.stop();
        } finally {
            if (previousHost === undefined) {
                delete process.env.HEALTH_HOST;
            } else {
                process.env.HEALTH_HOST = previousHost;
            }
        }
    });
});
