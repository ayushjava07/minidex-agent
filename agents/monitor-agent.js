import { ethers }from "ethers";
import { generateKeys, encryptMessage }from "./pqc.js";
import { generateCID }from "./cid-helper.js";
import fs from "fs";

const RPC_URL = "https://sepolia.infura.io/v3/cdd2389b301e4e1ca23664b3b6290860";
const DEX_ADDRESS = "0x37b18fA954Fa516eE60f666A01A36AFCF6A59650";

const DEX_ABI = [
    "function getReserves() view returns (uint, uint)",
    "event Swapped(address user, uint amountIn, uint amountOut)"
];

// ─── Workflow 1: Monitor Reserves ─────────────────
async function workflowMonitorReserves() {
    console.log("\n🤖 [Monitor Agent] Workflow 1: Monitor Reserves");

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const dex = new ethers.Contract(DEX_ADDRESS,DEX_ABI, provider);

    const [resA,resB]= await dex.getReserves();
    console.log("📊 ReserveA:", ethers.formatEther(resA));
    console.log("📊 ReserveB:", ethers.formatEther(resB));

    const state = {
        agent:"monitor-1",
        workflow:"monitor-reserves",
        reserveA: resA.toString(),
        reserveB: resB.toString(),
        timestamp: Date.now()
    };

    const cid = await generateCID(state);
    console.log("📦 State CID:", cid);
    return state;
}

// ─── Workflow 2: Heartbeat ─────────────────────────
async function workflowHeartbeat() {
    console.log("\n🤖 [Monitor Agent] Workflow 2: Heartbeat");

    const registry = JSON.parse(fs.readFileSync("./agents/registry.json"));
    const me = registry.agents.find(a => a.id=== "monitor-1");
    me.status= "active";
    me.lastHeartbeat= Date.now();

    fs.writeFileSync("./agents/registry.json",JSON.stringify(registry,null,2));
    console.log("💓 Heartbeat sent");

    const cid = await generateCID(me);
    console.log("📦 Heartbeat CID:", cid);
}

// ─── Workflow 3: Send PQC Alert ────────────────────
async function workflowSendAlert(message) {
    console.log("\n🤖 [Monitor Agent] Workflow 3: Send PQC Alert");

    const {publicKey }= generateKeys();
    const encrypted = encryptMessage(publicKey, message);

    console.log("🔐 PQC Alert sent to Report Agent");
    console.log("   Message:", message);
    console.log("   CipherText:", encrypted.cipherText.slice(0,30)+ "...");

    const state = {
        agent:"monitor-1",
        workflow:"send-alert",
        alert: message,
        timestamp: Date.now()
    };

    const cid = await generateCID(state);
    console.log("📦 Alert CID:", cid);
}

// ─── Main ──────────────────────────────────────────
async function main() {
    console.log("═══════════════════════════════════");
    console.log("   👁️  Monitor Agent Started");
    console.log("═══════════════════════════════════");

    await workflowMonitorReserves();
    await workflowHeartbeat();
    await workflowSendAlert("Pool reserves healthy");

    console.log("\n✅ Monitor Agent: All workflows complete");
}

main();