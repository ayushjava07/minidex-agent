import { expect } from "chai";
import { createMessageDispatcher, loadMessageDispatchConfig } from "../agents/message-dispatch.js";

describe("Bounded message handler dispatch", function () {
    it("preserves result order while bounding concurrency", async function () {
        let active = 0;
        let maxActive = 0;
        const dispatcher = createMessageDispatcher({ timeoutMs: 100, concurrency: 2 });
        const handlers = Array.from({ length: 5 }, (_, index) => async () => {
            active++;
            maxActive = Math.max(maxActive, active);
            await new Promise(resolve => setTimeout(resolve, 5));
            active--;
            return index;
        });

        const result = await dispatcher.dispatch(handlers, {});
        expect(result).to.include({ total: 5, succeeded: 5, failed: 0 });
        expect(result.results.map(item => item.value)).to.deep.equal([0, 1, 2, 3, 4]);
        expect(maxActive).to.equal(2);
    });

    it("isolates failures and times out stalled handlers", async function () {
        const errors = [];
        const dispatcher = createMessageDispatcher({
            timeoutMs: 5,
            concurrency: 2,
            onError: (error, context) => errors.push({ error, context }),
        });
        const result = await dispatcher.dispatch([
            async () => "ok",
            async () => { throw new Error("broken"); },
            () => new Promise(() => {}),
        ], {}, { topic: "task" });

        expect(result).to.include({ total: 3, succeeded: 1, failed: 2 });
        expect(errors[0].error.message).to.equal("broken");
        expect(errors[1].error.code).to.equal("HANDLER_TIMEOUT");
        expect(errors[1].context).to.include({ topic: "task", handlerIndex: 2 });
    });

    it("loads validated dispatch configuration", function () {
        expect(loadMessageDispatchConfig({
            NETWORK_HANDLER_TIMEOUT_MS: "250",
            NETWORK_HANDLER_CONCURRENCY: "8",
        })).to.deep.equal({ timeoutMs: 250, concurrency: 8 });
        expect(() => loadMessageDispatchConfig({ NETWORK_HANDLER_CONCURRENCY: "0" }))
            .to.throw("NETWORK_HANDLER_CONCURRENCY must be a positive integer");
    });
});
