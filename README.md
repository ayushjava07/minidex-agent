Markdown
# MiniDEX + Multi-Agent System

## Architecture
- 2 ERC20 tokens + 1 AMM pool on Sepolia
- 3 agents: deploy, monitor, report
- PQC encrypted inter-agent messaging
- IPLD schemas for state storage
- CID based content addressing

## Contracts (Sepolia)
- TokenA:  0x111...
- TokenB:  0x222...
- MiniDEX: 0x333...

## Setup
npm install
npx hardhat vars set INFURA_API_KEY
npx hardhat vars set SEPOLIA_PRIVATE_KEY

## Deploy
npx hardhat ignition deploy ./ignition/modules/Deploy.js --network sepolia

## Run Agents
node agents/deploy-agent.js
node agents/monitor-agent.js
node agents/report-agent.js

## Fault Tolerance Demo
node agents/kill-agent.js
node agents/report-agent.js