import { expect } from "chai";
import { logTask, logExecution, verifyTaskIntegrity, getTaskHistory, getExecutionHistory } from "../agents/ipld-logger.js";
import fs from "fs";
import path from "path";

describe("IPLD (InterPlanetary Linked Data)", function () {
    const LOG_FILE = path.join(process.cwd(), 'agents', 'task-log.json');
    const EXEC_FILE = path.join(process.cwd(), 'agents', 'execution-log.json');
    
    let originalLogContent = "";
    let originalExecContent = "";

    before(function () {
        // Backup logs
        if (fs.existsSync(LOG_FILE)) originalLogContent = fs.readFileSync(LOG_FILE, "utf8");
        if (fs.existsSync(EXEC_FILE)) originalExecContent = fs.readFileSync(EXEC_FILE, "utf8");
        
        // Clear logs for testing
        fs.writeFileSync(LOG_FILE, "[]");
        fs.writeFileSync(EXEC_FILE, "[]");
    });

    after(function () {
        // Restore logs
        if (originalLogContent) fs.writeFileSync(LOG_FILE, originalLogContent);
        if (originalExecContent) fs.writeFileSync(EXEC_FILE, originalExecContent);
    });

    it("Should log a task and generate a valid CID", async function () {
        const taskData = {
            agent: "test-agent",
            workflow: "DEPLOY",
            status: "PENDING",
            explanation: "Deploying TokenA"
        };

        const cid = await logTask(taskData);
        expect(cid).to.be.a("string");
        expect(cid).to.match(/^bafy/); // Typical CID v1 prefix for dag-cbor

        const history = getTaskHistory();
        const loggedTask = history.find(t => t.task_id === cid);
        expect(loggedTask).to.exist;
        expect(loggedTask.workflow).to.equal("DEPLOY");
    });

    it("Should verify integrity of a logged task", async function () {
        const taskData = {
            agent: "test-agent",
            workflow: "MONITOR",
            status: "SUCCESS"
        };

        const cid = await logTask(taskData);
        const isValid = await verifyTaskIntegrity(cid);
        expect(isValid).to.be.true;

        // Tamper with file
        const history = JSON.parse(fs.readFileSync(LOG_FILE, "utf8"));
        const idx = history.findIndex(t => t.task_id === cid);
        history[idx].workflow = "TAMPERED";
        fs.writeFileSync(LOG_FILE, JSON.stringify(history, null, 2));

        const isValidAfterTamper = await verifyTaskIntegrity(cid);
        expect(isValidAfterTamper).to.be.false;
    });

    it("Should log an execution and link it to a task", async function () {
        const taskCID = "bafytesttaskcid";
        const execData = {
            taskCID: taskCID,
            event: "CONTRACT_DEPLOYED",
            agent: "deployer",
            outcome: "success",
            txHash: "0x123..."
        };

        const cid = await logExecution(execData);
        expect(cid).to.be.a("string");

        const history = getExecutionHistory();
        const loggedExec = history.find(e => e.log_id === cid);
        expect(loggedExec).to.exist;
        expect(loggedExec.task_ref).to.equal(taskCID);
    });
});
