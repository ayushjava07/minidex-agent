# 🚀 MiniDEX Agent - ATOS Project

## 🌐 Autonomous Token Orchestration System

[![License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![Network](https://img.shields.io/badge/Network-Sepolia-blue.svg)]()
[![Frontend](https://img.shields.io/badge/Frontend-Vercel-black.svg)](https://minidex-agent.vercel.app)

---

## 🔗 Live Links

* 🌍 Frontend: https://minidex-agent.vercel.app
* 💻 GitHub: https://github.com/ayushjava07/minidex-agent
* 📚 Docs: https://www.notion.so/DAY2-MINIDEX-AGENT-350a3675be7d8058bce4f3c0cb1eeae5

---

## 📋 Overview

**ATOS (Autonomous Token Orchestration System)** is a decentralized system combining:

* ERC-20 token lifecycle
* AMM-based DEX (MiniDEX)
* Multi-agent coordination
* Post-Quantum Cryptography (PQC)
* IPLD-based state management
* Content-addressed storage via CID

---

## 🏗️ Architecture

```
Frontend (Vercel)
        │
        ▼
Ethereum Sepolia
 ├── TokenA
 ├── TokenB
 └── MiniDEX (x*y=k)
        │
        ▼
Multi-Agent System
 ├── Deploy Agent
 ├── Monitor Agent
 ├── Report Agent
        │
        ▼
PQC Encryption + CID + IPLD
```

---

## 📁 Project Structure

```
minidex-agent/
├── contracts/
│   ├── TokenA.sol
│   ├── TokenB.sol
│   └── MiniDEX.sol
├── agents/
│   ├── deploy-agent.js
│   ├── monitor-agent.js
│   ├── report-agent.js
│   ├── kill-agent.js
│   ├── pqc.js
│   ├── cid-helper.js
│   └── registry.json
├── ipld/
│   └── schema.ipldsch
├── ignition/
│   └── modules/
│       └── Deploy.js
├── scripts/
│   └── addLiquidity.js
├── frontend/
├── hardhat.config.js
├── package.json
└── README.md
```

---

## 🧾 Smart Contracts

### 🔹 TokenA & TokenB

* ERC-20 tokens
* 1,000,000 initial supply
* Deployed on Sepolia

### 🔹 MiniDEX

* AMM formula: `x * y = k`

Functions:

* `addLiquidity(amountA, amountB)`
* `swapAforB(amountA)`
* `swapBforA(amountB)`
* `removeLiquidity(amountA, amountB)`
* `getReserves()`

---

## 🤖 Multi-Agent System

### 🔹 Deploy Agent

* Deploy contracts
* Initialize liquidity
* Register peers

### 🔹 Monitor Agent

* Monitor reserves
* Heartbeat system
* PQC alerts

### 🔹 Report Agent

* Generate reports
* Fault detection
* System summary

### ⚡ Fault Tolerance

```bash
node agents/kill-agent.js
node agents/report-agent.js
```

---

## 🔐 Post-Quantum Cryptography (PQC)

Using **ML-KEM-768 (NIST 2024)**

```js
const { publicKey, secretKey } = generateKeys();
const { cipherText } = encryptMessage(publicKey, message);
const secret = decryptMessage(secretKey, cipherText);
```

---

## 📦 CID / Content Addressing

```js
const cid = await generateCID(agentState);
```

* Immutable state
* Tamper-proof logs
* Content-based addressing

---

## 📊 IPLD Schema

```
type AgentState struct {
  id String
  role String
  status String
  lastHeartbeat Int
  workflow String
}
```

---

## ⚙️ Setup & Installation

### Prerequisites

* Node.js v18+
* MetaMask
* Sepolia ETH

---

### Install

```bash
git clone https://github.com/ayushjava07/minidex-agent
cd minidex-agent
npm install
```

---

### Environment Variables

```bash
npx hardhat vars set INFURA_API_KEY
npx hardhat vars set SEPOLIA_PRIVATE_KEY
npx hardhat vars set ETHERSCAN_API_KEY
```

---

### Deploy Contracts

```bash
npx hardhat ignition deploy ./ignition/modules/Deploy.js --network sepolia
```

---

### Add Liquidity

```bash
node scripts/addLiquidity.js
```

---

## ▶️ Run Agents

```bash
node agents/deploy-agent.js
node agents/monitor-agent.js
node agents/report-agent.js
```

---

## 🖥️ Frontend

```bash
cd frontend
npm install
npm run dev
```

Live: https://minidex-agent.vercel.app

---

## 🚀 Features

* MetaMask connect
* Token swap
* Liquidity management
* Pool analytics
* Agent dashboard

---

## 📈 Roadmap

* libp2p peer discovery
* Dockerized agents
* Governance agent
* Analytics system
* CI/CD pipeline
* CEX integration

---

## 🛠 Tech Stack

| Layer      | Tech              |
| ---------- | ----------------- |
| Contracts  | Solidity, Hardhat |
| Blockchain | Ethereum Sepolia  |
| Frontend   | React, Vite       |
| Agents     | Node.js           |
| Security   | PQC               |
| Storage    | CID, IPLD         |
| Deployment | Vercel            |

---

## 👨‍💻 Author

**Ayush Kumar**
GitHub: https://github.com/ayushjava07

---

## 📄 License

MIT License
