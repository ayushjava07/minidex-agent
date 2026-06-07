import { expect } from "chai";
import {
    createMessageEnvelope,
    loadMessageValidationConfig,
    parseMessage,
    validateMessageEnvelope
} from "../agents/message-schema.js";

describe("Network message security validation", function () {
    const validMessage = {
        topic: "agent-tasks",
        data: { type: "DEPLOY_COMPLETE", contracts: { dex: "0x123" } },
        from: "deploy",
        ts: 1
    };

    it("accepts a valid message envelope", function () {
        expect(parseMessage(JSON.stringify(validMessage))).to.deep.equal(validMessage);
        expect(createMessageEnvelope("heartbeat", { status: "active" }, "monitor", 2))
            .to.deep.equal({ topic: "heartbeat", data: { status: "active" }, from: "monitor", ts: 2 });
    });

    it("rejects malformed and unexpected envelope fields", function () {
        expect(() => parseMessage("{not-json")).to.throw("Message must contain valid JSON");
        expect(() => validateMessageEnvelope({ ...validMessage, topic: "../admin" }))
            .to.throw("Message topic must be a lowercase alphanumeric identifier");
        expect(() => validateMessageEnvelope({ ...validMessage, elevated: true }))
            .to.throw("Message envelope contains unexpected fields: elevated");
        expect(() => validateMessageEnvelope({ ...validMessage, data: "not-an-object" }))
            .to.throw("Message data must be an object");
    });

    it("rejects oversized, deeply nested, and unsafe data", function () {
        expect(() => parseMessage(JSON.stringify(validMessage), { maxMessageBytes: 10 }))
            .to.throw("Message exceeds maximum size of 10 bytes");

        let nested = {};
        for (let index = 0; index < 10; index++) nested = { child: nested };
        expect(() => validateMessageEnvelope({ ...validMessage, data: nested }))
            .to.throw("Message data exceeds maximum depth");

        const unsafe = JSON.parse('{"constructor":{"polluted":true}}');
        expect(() => validateMessageEnvelope({ ...validMessage, data: unsafe }))
            .to.throw("Message data contains forbidden key: constructor");
    });

    it("validates maximum message size configuration", function () {
        expect(loadMessageValidationConfig({ NETWORK_MAX_MESSAGE_BYTES: "2048" }))
            .to.deep.equal({ maxMessageBytes: 2048 });
        expect(() => loadMessageValidationConfig({ NETWORK_MAX_MESSAGE_BYTES: "0" }))
            .to.throw("NETWORK_MAX_MESSAGE_BYTES must be a positive integer");
    });
});
