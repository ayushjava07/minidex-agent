import { expect } from "chai";
import { createMetricsRegistry } from "../agents/metrics.js";
import { createRuntimeMetricsCollector } from "../agents/runtime-metrics.js";

describe("Runtime metrics collection", function () {
    function createMetricSet(registry) {
        const names = [
            "uptimeSeconds",
            "residentMemoryBytes",
            "heapUsedBytes",
            "heapTotalBytes",
            "externalMemoryBytes",
            "cpuUserSeconds",
            "cpuSystemSeconds",
            "eventLoopLagSeconds",
        ];
        return Object.fromEntries(names.map(name => [
            name,
            registry.gauge(`test_${name}`, `Test ${name}.`, ["role"]),
        ]));
    }

    it("collects process memory, CPU, uptime, and event-loop lag", function () {
        const registry = createMetricsRegistry();
        let now = 1000;
        let cpuCall = 0;
        const collector = createRuntimeMetricsCollector({
            role: "monitor",
            intervalMs: 100,
            metrics: createMetricSet(registry),
            clock: () => now,
            uptime: () => 42,
            memoryUsage: () => ({ rss: 1000, heapUsed: 500, heapTotal: 800, external: 100 }),
            cpuUsage: () => cpuCall++ === 0 ? { user: 0, system: 0 } : { user: 250000, system: 50000 },
        });

        now = 1150;
        const snapshot = collector.collect();
        expect(snapshot).to.deep.include({
            role: "monitor",
            uptimeSeconds: 42,
            eventLoopLagSeconds: 0.05,
        });
        expect(snapshot.memory).to.deep.equal({
            rssBytes: 1000,
            heapUsedBytes: 500,
            heapTotalBytes: 800,
            externalBytes: 100,
        });

        const output = registry.render();
        expect(output).to.include('test_residentMemoryBytes{role="monitor"} 1000');
        expect(output).to.include('test_cpuUserSeconds{role="monitor"} 0.25');
        expect(output).to.include('test_eventLoopLagSeconds{role="monitor"} 0.05');
    });

    it("starts and stops one periodic collection timer", function () {
        const registry = createMetricsRegistry();
        let scheduled;
        let cancelled;
        const collector = createRuntimeMetricsCollector({
            role: "report",
            metrics: createMetricSet(registry),
            schedule(callback, intervalMs) {
                scheduled = { callback, intervalMs };
                return 99;
            },
            cancel(timer) {
                cancelled = timer;
            },
        });

        expect(collector.start()).to.equal(true);
        expect(collector.start()).to.equal(false);
        expect(collector.running).to.equal(true);
        expect(scheduled.intervalMs).to.equal(10000);
        scheduled.callback();
        expect(collector.stop()).to.equal(true);
        expect(cancelled).to.equal(99);
        expect(collector.running).to.equal(false);
        expect(collector.stop()).to.equal(false);
    });

    it("rejects invalid collector configuration and metric values", function () {
        expect(() => createRuntimeMetricsCollector({ role: "", intervalMs: 100 }))
            .to.throw("role must be a non-empty string");
        expect(() => createRuntimeMetricsCollector({ role: "deploy", intervalMs: 0 }))
            .to.throw("intervalMs must be a positive integer");
    });
});
