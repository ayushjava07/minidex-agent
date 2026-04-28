import fs from "fs";

const registry = JSON.parse(fs.readFileSync("./agents/registry.json"));

// Kill monitor agent
const monitor = registry.agents.find(a => a.id=== "monitor-1");
monitor.status= "failed";

fs.writeFileSync("./agents/registry.json",JSON.stringify(registry,null,2));

console.log("💀 monitor-1 marked as FAILED");
console.log("🔄 Run report-agent.js to see fault tolerance");