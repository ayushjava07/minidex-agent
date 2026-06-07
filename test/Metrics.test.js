import { expect } from "chai";
import {
    classifyMetricError,
    createMetricsRegistry,
} from "../agents/metrics.js";

describe("Metrics collection", function () {
    it("collects counters, gauges, and histograms in Prometheus format", function () {
        const registry = createMetricsRegistry();
        const counter = registry.counter("requests_total", "Processed requests.", ["method"]);
        const gauge = registry.gauge("active_connections", "Current connections.", ["role"]);
        const histogram = registry.histogram(
            "request_duration_seconds",
            "Request duration.",
            ["route"],
            { buckets: [0.1, 1] },
        );

        counter.inc({ method: "GET" });
        counter.inc({ method: "GET" }, 2);
        gauge.set({ role: "monitor" }, 4);
        gauge.dec({ role: "monitor" });
        histogram.observe({ route: "/health" }, 0.25);

        const output = registry.render();
        expect(output).to.include("# TYPE requests_total counter");
        expect(output).to.include('requests_total{method="GET"} 3');
        expect(output).to.include('active_connections{role="monitor"} 3');
        expect(output).to.include('request_duration_seconds_bucket{route="/health",le="0.1"} 0');
        expect(output).to.include('request_duration_seconds_bucket{route="/health",le="1"} 1');
        expect(output).to.include('request_duration_seconds_count{route="/health"} 1');
    });

    it("rejects invalid metric definitions and observations", function () {
        const registry = createMetricsRegistry();
        expect(() => registry.counter("invalid metric", "help")).to.throw("Invalid metric name");

        const counter = registry.counter("events_total", "Events.", ["type"]);
        expect(() => counter.inc({})).to.throw("Metric labels must contain exactly: type");
        expect(() => counter.inc({ type: "failure" }, -1)).to.throw("must not be negative");
        expect(() => registry.counter("events_total", "Duplicate.")).to.throw("Metric already registered");
    });

    it("classifies operational metric failures", function () {
        expect(classifyMetricError(new Error("Message authentication failed"))).to.equal("authentication");
        expect(classifyMetricError(new Error("Replay attack detected"))).to.equal("replay");
        expect(classifyMetricError(new Error("Message exceeds maximum size"))).to.equal("oversized");
        expect(classifyMetricError(new Error("other"))).to.equal("unknown");
    });
});
