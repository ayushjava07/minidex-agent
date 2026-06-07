import { expect } from "chai";
import {
    createDeliveryPolicy,
    DeliveryPolicyError,
} from "../agents/delivery-policy.js";

describe("Network delivery policies", function () {
    it("accepts delivery that satisfies recipient and ratio requirements", function () {
        const policy = createDeliveryPolicy({ minRecipients: 2, minSuccessRatio: 0.5 });
        const result = { sent: 2, total: 4 };
        expect(policy.assert(result)).to.equal(result);
    });

    it("rejects insufficient recipients with typed delivery context", function () {
        const policy = createDeliveryPolicy({ minRecipients: 3 });
        let error;
        try {
            policy.assert({ sent: 2, total: 4 });
        } catch (caught) {
            error = caught;
        }
        expect(error).to.be.instanceOf(DeliveryPolicyError);
        expect(error).to.include({ code: "DELIVERY_POLICY_FAILED" });
        expect(error.result).to.deep.equal({ sent: 2, total: 4 });
        expect(error.policy).to.deep.equal({
            minRecipients: 3,
            minSuccessRatio: 0,
            requireAll: false,
        });
    });

    it("enforces success ratio and all-recipient delivery", function () {
        expect(() => createDeliveryPolicy({ minSuccessRatio: 0.75 })
            .assert({ sent: 2, total: 4 })).to.throw("success ratio");
        expect(() => createDeliveryPolicy({ requireAll: true })
            .assert({ sent: 3, total: 4 })).to.throw("requires all recipients");
    });

    it("validates policy definitions and delivery results", function () {
        expect(() => createDeliveryPolicy({ minSuccessRatio: 2 }))
            .to.throw("between 0 and 1");
        expect(() => createDeliveryPolicy({ requireAll: "yes" }))
            .to.throw("must be a boolean");
        expect(() => createDeliveryPolicy().assert({ sent: 2, total: 1 }))
            .to.throw("invalid recipient counts");
    });
});
