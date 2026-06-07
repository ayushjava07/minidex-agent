# MiniDEX Agent — ATOS (Autonomous Token Orchestration System)

[![License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![Network](https://img.shields.io/badge/Network-Sepolia-blue.svg)]()
[![Frontend](https://img.shields.io/badge/Frontend-Vercel-black.svg)]()
[![Agents](https://img.shields.io/badge/Agents-5%20Running-brightgreen.svg)]()

## Overview

ATOS is a decentralized autonomous system combining ERC-20 token lifecycle (Sepolia), AMM-based DEX (MiniDEX), multi-agent system (libp2p), post-quantum cryptography (ML-KEM-768), and IPLD/CID-based state tracking.

## Architecture

```
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

## Smart Contracts

| Contract | Address |
|---------|--------|
| TokenA | `0xF7a7...5ED` |
| TokenB | `0x95C5...761` |
| MiniDEX | `0x37b1...650` |

Functions: `addLiquidity`, `swap`, `removeLiquidity`, `getReserves`.

## Multi-Agent System

- Agents run independently with libp2p Peer IDs
- Auto-discovery via mDNS, protocol `/atos/1.0.0`
- Heartbeat every 10s, failover after 30s
- State stored as IPLD DAG (CID)

### Agent Roles

- **Deploy Agent** — contract deployment logging, PQC encrypted broadcast, peer registration
- **Monitor Agent** — pool monitoring, heartbeat broadcast, low liquidity alerts
- **Report Agent** — fault detection, auto takeover, system summary
- **Liquidity Agent** — ratio monitoring, imbalance detection, rebalance suggestions
- **Analytics Agent** — swap history, TVL calculation, report generation

## Setup

### Prerequisites

- Node.js v18+
- MetaMask
- Sepolia ETH

### Installation

```bash
git clone https://github.com/ayushjava07/minidex-agent
cd minidex-agent
npm install
```

### Environment

```bash
cp .env.example .env
```

`SEPOLIA_PRIVATE_KEY` is required only for transactions and deployments. Use a dedicated, minimally funded testnet account. Never commit `.env`, private keys, seed phrases, or generated files under `agents/keys/`.

See [Secrets Management](docs/secrets.md) for configuration validation, credential rotation, production secret storage, and Git history cleanup.

See the [Threat Model](docs/threat-model.md) and
[Deployment Runbook](docs/deployment-runbook.md) before production rollout.

### Deploy

```bash
npx hardhat ignition deploy ./ignition/modules/Deploy.js --network sepolia
```

The deployment mints `1,000,000` TokenA and TokenB tokens to the deployer by default.
Override `MiniDEXModule.initialSupply` with an Ignition parameters file when a
different base-unit supply is required.

### Tests

```bash
npm test
npm run check:secrets
```

- `npm run test:unit` — isolated agent and mocked mesh workflow suite
- `npm run test:frontend` — browser-like dashboard integration suite
- `npm run test:network` — five-agent local mesh; fails unless every agent reaches all four peers and every test broadcast reaches all four recipients

### Add Liquidity

```bash
node scripts/addLiquidity.js
```

### Run Agents

```bash
npm run deploy
npm run monitor
npm run report
npm run liquidity
npm run analytics
```

## Production Operations

- Network logs are JSON; set `LOG_LEVEL` to `debug`, `info`, `warn`, or `error`.
- Liveness and readiness are available at `/health/live` and `/health/ready`.
- Prometheus metrics are available at `/metrics` on each agent health port.
- Health ports are `4101` through `4105` in agent role order.
- `HEALTH_MIN_PEERS` controls readiness.
- Readiness runs timeout-bound dependency checks; optional check failures report `degraded`
  without removing the agent from service.
- Peer dials use bounded backoff configured by the `NETWORK_RETRY_*` variables.
- Peer retry delays include jitter, skip permanent failures, and support cancellation.
- Inbound messages are rejected when they violate the envelope schema or exceed
  `NETWORK_MAX_MESSAGE_BYTES`.
- Authenticated inbound messages use per-sender and per-topic token buckets configured
  by the `NETWORK_RATE_LIMIT_*` variables.
- Runtime settings are validated together at agent startup, including cross-field retry
  and replay-window constraints. Validation errors report every invalid configuration section.

## Frontend

https://minidex-agent.vercel.app

Features: MetaMask connect, token swap, liquidity management, pool stats, agent dashboard.

## Project Structure

```
contracts/
agents/
schemas/
scripts/
frontend/
test/
.env
README.md
```
