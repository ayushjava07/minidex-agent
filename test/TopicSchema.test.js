import { expect } from "chai";
import {
    createSchemaValidator,
    createTopicSchemaRegistry,
    topicSchemas,
} from "../agents/topic-schema.js";

describe("Topic message schema validation", function () {
    it("validates known operational topic payloads", function () {
        expect(() => topicSchemas.validate({
            topic: "heartbeat",
            data: { agent: "monitor", status: "active", timestamp: new Date().toISOString() },
        })).not.to.throw();
        expect(() => topicSchemas.validate({
            topic: "agent-tasks",
            data: { type: "ANALYTICS_REPORT", report: { swaps: 3 } },
        })).not.to.throw();
    });

    it("rejects malformed known-topic payloads with field paths", function () {
        expect(() => topicSchemas.validate({
            topic: "heartbeat",
            data: { agent: 42, status: "active" },
        })).to.throw("$.data.agent: expected string");
        expect(() => topicSchemas.validate({
            topic: "task",
            data: { from: "report" },
        })).to.throw('missing required property "action"');
    });

    it("supports strict registries and custom schemas", function () {
        const registry = createTopicSchemaRegistry({ allowUnknownTopics: false });
        registry.register("commands", {
            type: "object",
            required: ["command"],
            additionalProperties: false,
            properties: {
                command: { type: "string", enum: ["start", "stop"] },
            },
        });

        expect(() => registry.validate({ topic: "commands", data: { command: "start" } })).not.to.throw();
        expect(() => registry.validate({ topic: "commands", data: { command: "delete" } }))
            .to.throw("must be one of");
        expect(() => registry.validate({ topic: "unknown", data: {} }))
            .to.throw("No message schema registered");
    });

    it("validates schema definitions before registration", function () {
        expect(() => createSchemaValidator({ type: "object", properties: [] }))
            .to.throw("properties must be an object");
        expect(() => createSchemaValidator({ type: "executable" }))
            .to.throw("unsupported type");
    });
});
