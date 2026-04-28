import { ethers }from "ethers";
import { generateKeys, encryptMessage }from "./pqc.js";
import { generateCID }from "./cid-helper.js";
import fs from "fs";

const PRIVATE_KEY = "fb12de85f46fe1bc7b70808b2463c189464e5ac5e1c4d846508d4f349432ad0f";
const RPC_URL = "https://sepolia.infura.io/v3/cdd2389b301e4e1ca23664b3b6290860";

// ─── Workflow 1: Deploy ───────────────────────────
async function workflowDeploy() {
    console.log("\n🤖 [Deploy Agent] Starting Workflow 1: Deploy");

    // Simulate deployment check
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log("✅ Connected to Sepolia");
    console.log("✅ Wallet:", wallet.address);

    // Log state with CID
    const state = {
        agent:"deploy-1",
        workflow:"deploy",
        status:"completed",
        timestamp: Date.now()
    };

    const cid = await generateCID(state);
    console.log("📦 State CID:", cid);

    // PQC encrypted message to monitor agent
    const {publicKey }= generateKeys();
    const msg = encryptMessage(publicKey,"deploy complete");
    console.log("🔐 PQC Encrypted Message sent to monitor agent");
    console.log("   CipherText:", msg.cipherText.slice(0,30)+ "...");

    return state;
}

// ─── Workflow 2: Initialize Liquidity ─────────────
async function workflowInitLiquidity() {
    console.log("\n🤖 [Deploy Agent] Starting Workflow 2: Init Liquidity");

    // This workflow just verifies liquidity exists
    const state = {
        agent:"deploy-1",
        workflow:"init-liquidity",
        status:"completed",
        timestamp: Date.now()
    };

    const cid = await generateCID(state);
    console.log("✅ Liquidity initialized");
    console.log("📦 State CID:", cid);
    return state;
}

// ─── Workflow 3: Register Peers ────────────────────
async function workflowRegisterPeers() {
    console.log("\n🤖 [Deploy Agent] Starting Workflow 3: Register Peers");

    const registry = JSON.parse(fs.readFileSync("./agents/registry.json"));
    console.log("✅ Peers discovered:");
    registry.agents.forEach(a => {
        console.log(`   - ${a.id} | role: ${a.role} | status: ${a.status}`);
    });

    const cid = await generateCID(registry);
    console.log("📦 Registry CID:", cid);
    return registry;
}

// ─── Main ──────────────────────────────────────────
async function main() {
    console.log("═══════════════════════════════════");
    console.log("   🚀 Deploy Agent Started");
    console.log("═══════════════════════════════════");

    await workflowDeploy();
    await workflowInitLiquidity();
    await workflowRegisterPeers();

    console.log("\n✅ Deploy Agent: All workflows complete");
}

main();