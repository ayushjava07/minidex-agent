# MiniDEX Agent - ATOS (Autonomous Token Orchestration System)

[![License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![Network](https://img.shields.io/badge/Network-Sepolia-blue.svg)]()
[![Frontend](https://img.shields.io/badge/Frontend-Vercel-black.svg)]()
[![Filecoin](https://img.shields.io/badge/Storage-Filecoin-0090FF.svg)]()
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

- Five agent roles communicate over a local libp2p TCP mesh
- Peer connections use the authenticated `/atos/1.0.0` protocol
- Heartbeat every 10s, failover after 30s
- State stored as IPLD DAG (CID)

### Agent Roles

- **Deploy Agent** — contract deployment logging, PQC encrypted broadcast, peer registration
- **Monitor Agent** — pool monitoring, heartbeat broadcast, low liquidity alerts
- **Report Agent** — fault detection, auto takeover, system summary
- **Liquidity Agent** — ratio monitoring, imbalance detection, rebalance suggestions
- **Analytics Agent** — swap history, TVL calculation, report generation

## Quick Start

### Prerequisites

- Node.js 22
- npm 10+
- Git
- MetaMask and Sepolia ETH only for testnet interaction

### Installation

```bash
git clone https://github.com/ayushjava07/minidex-agent
cd minidex-agent
npm ci
npm ci --prefix frontend
```

Use `npm ci` to install the exact dependency versions in the lockfiles.

### Configuration

```bash
cp .env.example .env
```

Replace the placeholder values required for the command you intend to run.
`SEPOLIA_PRIVATE_KEY` is required only for transactions and Sepolia deployments.
Use a dedicated, minimally funded testnet account. Never commit `.env`, private
keys, seed phrases, or generated files under `agents/keys/`.

See [Secrets Management](docs/secrets.md) for configuration validation, credential rotation, production secret storage, and Git history cleanup.

See the [Threat Model](docs/threat-model.md) and
[Deployment Runbook](docs/deployment-runbook.md) before production rollout.

### Verify The Repository

Run the complete submission validation:

```bash
npm run verify
```

This runs the committed-secret scan, contract/agent/security/unit/frontend/live
network tests, and the production frontend build. The live network test binds
local TCP ports `4001` through `4005`.

Run individual checks when developing:

```bash
npm run check:secrets
npm run test:contracts
npm run test:agents
npm run test:security
npm run test:unit
npm run test:frontend
npm run test:network
npm run build
```

### Run The Dashboard

```bash
npm run dev
```

The dashboard and read-only status APIs start without a Filecoin provider.
Configure `STORACHA_TOKEN` or `LOTUS_API_URL` before using upload and retrieval
operations.

### Local Contract Deployment

```bash
npx hardhat ignition deploy ./ignition/modules/Deploy.js --network hardhat
```

### Sepolia Deployment

```bash
npx hardhat ignition deploy ./ignition/modules/Deploy.js --network sepolia
```

The deployment mints `1,000,000` TokenA and TokenB tokens to the deployer by default.
Override `MiniDEXModule.initialSupply` with an Ignition parameters file when a
different base-unit supply is required.

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

## Docker

The default Docker build runs the secret scan, complete test suite, frontend
production build, and local Hardhat Ignition deployment before producing the
runtime image. The base image is pinned by digest and the final image contains
only production dependencies, agent runtime source, schemas, and built frontend
assets.

### Build

```bash
docker build --pull --tag minidex-agent:project-silver .
```

To build only through the validation stage:

```bash
docker build --pull --target validation --tag minidex-agent:validation .
```

### Run

Create a local environment file from `.env.example`, replace every required
placeholder, then start all five agents:

```bash
docker run --rm --init \
  --name minidex-agent \
  --env-file .env \
  --publish 4001-4005:4001-4005 \
  --publish 4101-4105:4101-4105 \
  minidex-agent:project-silver
```

Generated keys and agent logs are written under `/app/agents`. For persistent
runtime state, mount the specific generated paths required by your deployment.
Do not bake secrets into the image or pass them as Docker build arguments.

Override the default command to run one operation:

```bash
docker run --rm --init --env-file .env \
  minidex-agent:project-silver npm run monitor

docker run --rm --init --env-file .env \
  minidex-agent:project-silver node scripts/addLiquidity.js
```

## Production Operations

- Network logs are JSON; set `LOG_LEVEL` to `debug`, `info`, `warn`, or `error`.
- Liveness and readiness are available at `/health/live` and `/health/ready`.
- Prometheus metrics are available at `/metrics` on each agent health port.
- Runtime metrics include process uptime, memory, CPU deltas, and event-loop lag.
- Health ports are `4101` through `4105` in agent role order.
- `HEALTH_MIN_PEERS` controls readiness, while `HEALTH_HOST` selects the health endpoint bind interface.
- Readiness runs timeout-bound dependency checks; optional check failures report `degraded`
  without removing the agent from service.
- Peer dials use bounded backoff configured by the `NETWORK_RETRY_*` variables.
- Peer retry delays include jitter, skip permanent failures, and support cancellation.
- Retry managers can be guarded by circuit breakers with closed, open, and half-open
  recovery states.
- Inbound messages are rejected when they violate the envelope schema or exceed
  `NETWORK_MAX_MESSAGE_BYTES`.
- Authenticated inbound messages use per-sender and per-topic token buckets configured
  by the `NETWORK_RATE_LIMIT_*` variables.
- Hierarchical global, sender, and sender/topic quotas protect against distributed floods,
  with bounded state and inspectable limiter statistics.
- Inbound security runs as an ordered middleware pipeline: authentication, replay
  protection, then rate limiting.
- Known message topics enforce payload schemas on send and receive; custom schemas can
  be registered for new topics.
- Runtime settings are validated together at agent startup, including cross-field retry
  and replay-window constraints. Validation errors report every invalid configuration section.

## Frontend

https://minidex-agent.vercel.app

Features: MetaMask connect, token swap, liquidity management, pool stats, agent dashboard, Filecoin storage dashboard.

## Project Structure

```
agents/       Multi-agent runtime, networking, security, and workflows
  filecoin-bridge.js  Agent-facing Filecoin integration
backend/      Express app, route groups, and Filecoin storage orchestration
  routes/     Dashboard-facing API route groups
config/       Environment loading and validation
contracts/    Solidity contracts
docs/         Security, deployment, and Filecoin documentation
frontend/     React dashboard, including Filecoin storage
ignition/     Hardhat Ignition deployment module
schemas/      IPLD schemas
scripts/      Operational and validation scripts
test/         Hardhat contract and agent tests
tests/        Vitest unit and integration tests
```

Generated build output, runtime logs, peer registries, cryptographic keys, and
local environment files are intentionally excluded from version control.
