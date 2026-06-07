import { expect } from "chai";
import { validateNetworkRun } from "../scripts/networkValidation.js";

describe("Network delivery validation", function () {
    const roles = ["deploy", "monitor", "report"];
    const statuses = roles.map(role => ({ role, peers: 2 }));
    const broadcasts = [
        { sender: "deploy", topic: "heartbeat", result: { sent: 2, total: 2 } }
    ];
    const deliveries = [
        { sender: "deploy", topic: "heartbeat", recipient: "monitor" },
        { sender: "deploy", topic: "heartbeat", recipient: "report" }
    ];

    it("accepts a fully connected run with complete delivery", function () {
        expect(() => validateNetworkRun({ roles, statuses, broadcasts, deliveries })).not.to.throw();
    });

    it("rejects an incomplete mesh", function () {
        const incompleteStatuses = [{ role: "deploy", peers: 1 }, ...statuses.slice(1)];

        expect(() => validateNetworkRun({
            roles,
            statuses: incompleteStatuses,
            broadcasts,
            deliveries
        })).to.throw("deploy connected to 1/2 peers");
    });

    it("rejects a partial broadcast send", function () {
        const partialBroadcasts = [
            { sender: "deploy", topic: "heartbeat", result: { sent: 1, total: 2 } }
        ];

        expect(() => validateNetworkRun({
            roles,
            statuses,
            broadcasts: partialBroadcasts,
            deliveries
        })).to.throw("deploy heartbeat sent to 1/2 peers");
    });

    it("rejects a broadcast that did not reach every recipient", function () {
        expect(() => validateNetworkRun({
            roles,
            statuses,
            broadcasts,
            deliveries: deliveries.slice(0, 1)
        })).to.throw("deploy heartbeat was not delivered to: report");
    });
});
