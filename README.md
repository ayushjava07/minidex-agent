# 🚀 MiniDEX Agent — ATOS Project

## Autonomous Token Orchestration System

[![License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![Network](https://img.shields.io/badge/Network-Sepolia-blue.svg)]()
[![Frontend](https://img.shields.io/badge/Frontend-Vercel-black.svg)](https://minidex-agent.vercel.app)

---

## 🔗 Live Links

* 🌐 Frontend: https://minidex-agent.vercel.app
* 💻 GitHub: https://github.com/ayushjava07/minidex-agent
* 🎥 Demo Video: https://vimeo.com/1187424544
* 📄 Docs: https://www.notion.so/DAY2-MINIDEX-AGENT-350a3675be7d8058bce4f3c0cb1eeae5

---

## ✅ Acceptance Criteria Status

| Requirement                  | Status         | Proof                     |
| ---------------------------- | -------------- | ------------------------- |
| ERC-20 standard tests        | ⚙️ In Progress | `test/` folder            |
| ERC-20 security checks       | ⚙️ In Progress | `test/` folder            |
| Live DEX with liquidity pool | ✅ Done         | Sepolia + frontend        |
| Peer discovery               | ✅ Done         | libp2p Peer IDs           |
| Task distribution            | ✅ Done         | 3 workflows per agent     |
| Fault tolerance              | ✅ Done         | heartbeat + auto-takeover |
| 3 workflows per agent        | ✅ Done         | deploy / monitor / report |
| PQC prototype                | ✅ Done         | ML-KEM-768 + AES-256      |
| CID usage                    | ✅ Done         | every workflow state      |
| IPLD schemas                 | ✅ Done         | `ipld/schema.ipldsch`     |
| Documentation                | ✅ Done         | this README               |

---

## 📌 Overview

ATOS is a **decentralized autonomous system** combining:

* ⚡ ERC-20 token lifecycle on Sepolia
* 🔄 AMM-based DEX (MiniDEX)
* 🤖 Multi-agent coordination (libp2p)
* 🔐 Post-Quantum Cryptography (PQC)
* 📦 IPLD-based content-addressed state

---

## 🏗️ Architecture

```
Frontend (Vercel)
        │
        ▼
Ethereum Sepolia (TokenA, TokenB, MiniDEX)
        │
        ▼
Multi-Agent System (libp2p)
        │
        ▼
PQC + IPLD + CID Layer
```

---

## 📜 Smart Contracts (Sepolia)

| Contract | Address                                      |
| -------- | -------------------------------------------- |
| TokenA   | `0xF7a7152a2A939e21e0B0aBb34F12e2B260c5A5ED` |
| TokenB   | `0x95C5F14106ab4d1dc0cFC9326C287B702619A761` |
| MiniDEX  | `0x37b18fA954Fa516eE60f666A01A36AFCF6A59650` |

### ⚙️ MiniDEX Functions

* `addLiquidity(amountA, amountB)`
* `swapAforB(amountA)`
* `swapBforA(amountB)`
* `removeLiquidity(amountA, amountB)`
* `getReserves()`

---

## 🤖 Multi-Agent System

### 🔄 How It Works

* Each agent runs independently with a **libp2p Peer ID**
* Communication via protocol: `/atos/1.0.0`
* Heartbeat every **10 seconds**
* Auto failover within **30 seconds**

---

### 🧠 Agents

#### 🚀 Deploy Agent (port 5001)

* Deploy state log (CID)
* PQC encrypted messaging
* Peer registration

#### 📊 Monitor Agent (port 5002)

* Pool reserve monitoring
* Heartbeat broadcast
* Low liquidity alerts

#### 📑 Report Agent (port 5003)

* System reports
* Fault detection
* Final summaries with CID

---

### ⚡ Fault Tolerance Demo

```bash
# Run agents
node agents/deploy-agent.js
node agents/monitor-agent.js
node agents/report-agent.js

# Kill monitor agent
node agents/kill-agent.js
```

👉 Report agent auto-detects failure and takes over.

---

## 🔐 Post-Quantum Cryptography

Using **ML-KEM-768 (NIST Standard)**

* Key exchange via KEM
* Shared secret → AES-256-GCM encryption
* Secure agent communication

---

## 🌐 IPLD Task DAG

Each workflow produces **CID-linked nodes**

```
ExecutionLog3
   │
ExecutionLog2
   │
ExecutionLog1
   │
Task DAG → Agent Identity
```

---

## ⚙️ Setup

### 📦 Prerequisites

* Node.js v18+
* MetaMask
* Sepolia ETH

---

### 📥 Install

```bash
git clone https://github.com/ayushjava07/minidex-agent
cd minidex-agent
npm install
```

---

### 🔑 Environment Variables

```bash
npx hardhat vars set INFURA_API_KEY
npx hardhat vars set SEPOLIA_PRIVATE_KEY
npx hardhat vars set ETHERSCAN_API_KEY
```

---

### 🚀 Deploy Contracts

```bash
npx hardhat ignition deploy ./ignition/modules/Deploy.js --network sepolia
```

---

### 💧 Add Liquidity

```bash
node scripts/addLiquidity.js
```

---

### ▶️ Run Agents

```bash
node agents/deploy-agent.js
node agents/monitor-agent.js
node agents/report-agent.js
```

---

### 🧪 Run Tests

```bash
npx hardhat test
```

---

## 👀 Example Output

```
[DEPLOY] Workflow complete — CID: bafy...
[MONITOR] ReserveA: 1000 TKA
[REPORT] All agents healthy

# After failure

[REPORT] Monitor agent offline — takeover initiated
```

---

## 💻 Frontend

🔗 https://minidex-agent.vercel.app

Features:

* MetaMask connect
* Token swap
* Liquidity management
* Pool stats (live)
* Agent dashboard

---

## 📂 Project Structure

```
minidex-agent/
├── contracts/
├── agents/
├── ipld/
├── test/
├── scripts/
├── frontend/
├── docs/
└── README.md
```

---

## 🛠️ Tech Stack

| Layer           | Technology          |
| --------------- | ------------------- |
| Smart Contracts | Solidity, Hardhat   |
| Blockchain      | Ethereum Sepolia    |
| Agents          | Node.js             |
| Networking      | libp2p              |
| Security        | ML-KEM-768, AES-256 |
| Data            | IPLD, CID           |
| Frontend        | React, Vite         |
| Deployment      | Vercel              |

---

## 🗺️ Roadmap

* Kademlia DHT peer discovery
* Dockerized agents
* Liquidity Manager Agent
* Analytics Agent
* Uniswap V3 integration
* CI/CD pipeline

---

## 👨‍💻 Author

**Ayush Kumar**
🔗 https://github.com/ayushjava07

---

## 📄 License

MIT
