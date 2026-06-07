# 🚀 MiniDEX Agent — ATOS Project  
### Autonomous Token Orchestration System

[![License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)  [![Network](https://img.shields.io/badge/Network-Sepolia-blue.svg)]()  [![Frontend](https://img.shields.io/badge/Frontend-Vercel-black.svg)](https://minidex-agent.vercel.app)  [![Agents](https://img.shields.io/badge/Agents-5%20Running-brightgreen.svg)]()  [![Tests](https://img.shields.io/badge/Tests-56%20Passing-success.svg)]()

---

## 🔗 Live Links

- 🌐 Frontend: https://minidex-agent.vercel.app  
- 💻 GitHub: https://github.com/ayushjava07/minidex-agent  
- 🎥 Demo: https://vimeo.com/1187424544  
- 📄 Docs: https://www.notion.so/DAY2-MINIDEX-AGENT-350a3675be7d8058bce4f3c0cb1eeae5  

---

## 📌 Overview

ATOS is a **decentralized autonomous system** combining:

- ⚡ ERC-20 token lifecycle (Sepolia)  
- 🔄 AMM-based DEX (MiniDEX)  
- 🤖 Multi-agent system (libp2p)  
- 🔐 Post-Quantum Cryptography  
- 📦 IPLD + CID-based state tracking  

---

## ✅ Acceptance Criteria

| Feature | Status | Proof |
|--------|--------|------|
| ERC-20 Tests | ✅ | 56 passing |
| Security Checks | ✅ | Edge cases covered |
| Live DEX | ✅ | Sepolia + frontend |
| Peer Discovery | ✅ | libp2p mDNS |
| Task Distribution | ✅ | 15 workflows |
| Fault Tolerance | ✅ | Auto takeover |
| PQC | ✅ | ML-KEM-768 |
| IPLD | ✅ | CID DAG |
| Docs | ✅ | README + Demo |

---

## 🏗️ Architecture

```text
Frontend (React + Vercel)
        ↓
MetaMask / ethers.js
        ↓
Ethereum (Sepolia)
 ├── TokenA
 ├── TokenB
 └── MiniDEX (AMM x*y=k)
        ↓
Multi-Agent Layer (libp2p)
 ├── Deploy Agent
 ├── Monitor Agent
 ├── Report Agent
 ├── Liquidity Agent
 └── Analytics Agent
        ↓
Security Layer (ML-KEM + AES)
        ↓
Data Layer (IPLD + CID DAG)
```

---

## 📜 Smart Contracts

| Contract | Address |
|---------|--------|
| TokenA | `0xF7a7...5ED` |
| TokenB | `0x95C5...761` |
| MiniDEX | `0x37b1...650` |

### ⚙️ Functions

- `addLiquidity(amountA, amountB)`
- `swap(tokenIn, amountIn)`
- `removeLiquidity(amountA, amountB)`
- `getReserves()`

Analytics consumes `Swapped(user, tokenIn, amountIn, amountOut)`. Existing
deployments must be redeployed after changing this event signature.

---

## 🤖 Multi-Agent System

### 🔄 How It Works

- Agents run independently with **libp2p Peer IDs**
- Auto-discovery via **mDNS**
- Protocol: `/atos/1.0.0`
- Heartbeat: **10 sec**
- Failover: **30 sec**
- State stored as **IPLD DAG (CID)**

---

## 🧠 Agent Roles

### 🚀 Deploy Agent
- Contract deployment logging  
- PQC encrypted broadcast  
- Peer registration  

### 📊 Monitor Agent
- Pool monitoring  
- Heartbeat broadcast  
- Low liquidity alerts  

### 📑 Report Agent
- Fault detection  
- Auto takeover  
- System summary  

### 💧 Liquidity Agent
- Ratio monitoring  
- Imbalance detection  
- Rebalance suggestions  

### 📈 Analytics Agent
- Swap history  
- TVL calculation  
- Report generation  

---

## ⚡ Fault Tolerance Demo

```bash
# Start agents
npm run deploy
npm run monitor
npm run report
npm run liquidity
npm run analytics
```

Kill monitor agent → Report agent auto takeover in 30s ✅

---

## 🔐 Post-Quantum Cryptography

- Algorithm: **ML-KEM-768 + AES-256-CBC**
- Standard: NIST FIPS 203  

Flow:

1. Keypair generation  
2. Shared secret encapsulation  
3. AES encryption  
4. Broadcast  
5. Decrypt on receiver  

---

## 📦 IPLD + CID

- All workflows stored as **CID-linked DAG**
- Tamper-proof execution logs  

Example:

```text
Task → Execution → Child Task → Execution
```

---

## ⚙️ Setup

### 📦 Prerequisites

- Node.js v18+  
- MetaMask  
- Sepolia ETH  

---

### 📥 Installation

```bash
git clone https://github.com/ayushjava07/minidex-agent
cd minidex-agent
npm install
```

---

### 🔑 Environment

Copy the safe template and provide values locally:

```bash
cp .env.example .env
```

`SEPOLIA_PRIVATE_KEY` is required only for transactions and deployments. Use a
dedicated, minimally funded testnet account. Never commit `.env`, private keys,
seed phrases, or generated files under `agents/keys/`.

See [Secrets Management](docs/secrets.md) for configuration validation,
credential rotation, production secret storage, and Git history cleanup.

---

### 🚀 Deploy

```bash
npx hardhat ignition deploy ./ignition/modules/Deploy.js --network sepolia
```

---

### 🧪 Tests

```bash
npm test
npm run check:secrets
```

`npm run test:unit` runs the isolated agent and mocked mesh workflow suite.
`npm run test:frontend` runs the browser-like dashboard integration suite.
`npm run test:network` starts the five-agent local mesh and fails unless every
agent reaches all four peers and every test broadcast reaches all four recipients.

Agent network logs are emitted as JSON. Set `LOG_LEVEL` to `debug`, `info`,
`warn`, or `error` to control verbosity.

Each agent exposes `GET /health/live` and `GET /health/ready` on localhost.
Default ports are `4101` through `4105` for deploy, monitor, report, liquidity,
and analytics respectively. Readiness requires `HEALTH_MIN_PEERS` connections.

---

### 💧 Add Liquidity

```bash
node scripts/addLiquidity.js
```

---

### ▶️ Run Agents

```bash
npm run deploy
npm run monitor
npm run report
npm run liquidity
npm run analytics
```

---

## 🌐 Frontend

https://minidex-agent.vercel.app  

**Features:**
- MetaMask connect  
- Token swap  
- Liquidity management  
- Pool stats  
- Agent dashboard  

---

## 📂 Project Structure

```text
contracts/
agents/
schemas/
scripts/
frontend/
test/
.env
README.md
```

---

## 🛠️ Tech Stack

| Layer | Tech |
|------|------|
| Smart Contracts | Solidity, Hardhat |
| Blockchain | Ethereum Sepolia |
| Agents | Node.js |
| Networking | libp2p |
| Security | ML-KEM, AES |
| Data | IPLD, CID |
| Frontend | React, ethers.js |
| Deploy | Vercel |

---

## 🗺️ Roadmap

### ✅ Done
- ERC-20 tokens  
- MiniDEX  
- 5 agents  
- PQC  
- IPLD  
- 56 tests  
- Fault tolerance  

### 🔄 Next
- DHT (Kademlia)  
- Docker support  
- Uniswap V3  
- CI/CD  
- CEX listing  

---

## 👨‍💻 Author

**Ayush Java**  
https://github.com/ayushjava07/minidex-agent  

---

## 📄 License

MIT  
