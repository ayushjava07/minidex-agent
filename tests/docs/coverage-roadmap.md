# Test Coverage Roadmap

## Current Coverage (Existing `test/`)

| Module | File | Coverage | Status |
|--------|------|----------|--------|
| MiniDEX contract | `test/MiniDEX.test.js` | Constructor, addLiquidity, swap, getAmountOut, getReserves | ✅ Complete |
| MiniDEX security | `test/Security.test.js` | removeLiquidity, swap edge cases, overflow protection | ✅ Complete |
| TokenA ERC20 | `test/TokenA.test.js` | Full ERC20 (transfer, approve, transferFrom, events, edge cases) | ✅ Complete |
| TokenB ERC20 | `test/TokenB.test.js` | Same as TokenA | ✅ Complete |
| IPLD logger | `test/IPLD.test.js` | logTask, verifyTaskIntegrity, logExecution, getTaskHistory, getExecutionHistory | ⚠️ Partial |
| PQC crypto | `test/PQC.test.js` | generateKeys, encryptMessage, decryptMessage | ⚠️ Partial |

## Target Coverage (New `tests/`)

### Phase 1 — Unit Tests (High Priority)

| Module | File | Functions to Test | Priority |
|--------|------|-------------------|----------|
| **network.js** | `tests/unit/network.test.js` | `createAgentNode`, `connectToAllPeers`, `publishMessage`, `subscribeToTopic`, `getNetworkStatus`, `agentRegistry` | 🔴 Critical |
| **ipld-logger.js** | `tests/unit/ipld-logger.test.js` | `logTask`, `logExecution`, `getFullDAG`, `getNode`, `getTaskHistory`, `getExecutionHistory`, `verifyTaskIntegrity`, `escalateToHuman`, `printDAG` | 🔴 Critical |
| **pqc.js** | `tests/unit/pqc.test.js` | `generateKeys`, `encryptMessage`, `decryptMessage`, `getMyPublicKey` | 🔴 Critical |
| **cid-helper.js** | `tests/unit/cid-helper.test.js` | `generateCID` | 🟡 Medium |

### Phase 2 — Integration Tests

| Scenario | File | What It Tests | Priority |
|----------|------|---------------|----------|
| Agent mesh formation | `tests/integration/agent-mesh.test.js` | All 5 agents create, register, connect, broadcast | 🔴 Critical |
| IPLD DAG chain | `tests/integration/ipld-chain.test.js` | Full lifecycle: task → execution → subtask → DAG traversal → integrity verify | 🟡 Medium |
| PQC lifecycle | `tests/integration/pqc-encryption.test.js` | Keys → encrypt → decrypt → tamper detection | 🟡 Medium |

### Phase 3 — Agent Workflow Tests (Future)

| File | What to Test | Priority |
|------|-------------|----------|
| `tests/unit/deploy-agent.test.js` | deploy-agent-v2.js workflow: waitForPeer, task creation, event handling | 🟢 Low |
| `tests/unit/monitor-agent.test.js` | monitor-agent-v2.js: pool monitoring, event subscription | 🟢 Low |
| `tests/unit/report-agent.test.js` | report-agent-v2.js: fault detection, backup monitoring | 🟢 Low |
| `tests/unit/liquidity-agent.test.js` | liquidity-agent.js: reserve ratio, imbalance alerts, rebalance suggestions | 🟢 Low |
| `tests/unit/analytics-agent.test.js` | analytics-agent.js: swap history, pool stats, reports | 🟢 Low |

## Edge Cases to Cover

### network.js
- Unknown role passed to `createAgentNode` → throws
- Empty registry when calling `connectToAllPeers` → returns 0
- Self-connection in `connectToAllPeers` → skipped
- Self-connection in `publishMessage` → skipped
- All dials fail in `connectToAllPeers` → returns 0
- All connections drop from `publishMessage` → returns {sent:0, total:0}
- Multiple subscriptions to same topic → all handlers fire
- Registry cleared between operations → graceful recovery

### ipld-logger.js
- Missing required fields (agent, workflow, status) → throws
- File does not exist yet → creates file
- File is corrupted JSON → returns `[]`
- Subtask registration with no parent → no-op
- Task metadata tampered → `verifyTaskIntegrity` returns false
- getFullDAG on unknown CID → null
- getNode on unknown CID → null
- Escalate on unknown CID → no-op
- DAG depth > 10 (infinite loop guard) → truncates

### pqc.js
- Missing public key for target → encrypt returns null
- Missing secret key for own role → decrypt throws
- Corrupted cipherText → decrypt throws
- tampered encryptedMessage → decryption fails or garbled output
- Missing keys directory → creates it
- generateKeys called twice → loads existing, no duplicate

## Failure Scenarios

| Scenario | How to Trigger | Expected Behavior |
|----------|---------------|-------------------|
| Multiaddr with undefined port | `info.port` is undefined | `multiaddr()` throws "Value must be an integer" |
| libp2p node fails to start | `createLibp2p` rejects | `createAgentNode` propagates rejection |
| Stream send fails | `conn.newStream` rejects | `publishMessage` catches, continues to next peer |
| Peer dial timeout | `node.dial` hangs or rejects | `connectToAllPeers` catches, continues |
| JSON parse failure on incoming stream | Malformed payload | Handler error caught, stream closed gracefully |
| Topic handler throws synchronously | Handler function throws | Error caught, other handlers still fire |
| Topic handler rejects asynchronously | Handler returns rejecting promise | Error caught by catch handler |
| Multiple agents stop concurrently | All `node.stop()` called near-simultaneously | No crashes, all stop cleanly |

## Dependency Injection Points (for mocking)

| Real Dependency | Module | Mock Approach |
|----------------|--------|---------------|
| `createLibp2p` | `libp2p` | `vi.mock('libp2p')` — return mock node |
| `tcp`, `noise`, `yamux`, `identify` | various libp2p packages | `vi.mock` — return empty objects |
| `multiaddr` | `@multiformats/multiaddr` | `vi.mock` — throw on undefined, parse string |
| `pipe` | `it-pipe` | `vi.mock` — pass-through |
| `fs` | built-in | `vi.mock('fs')` — in-memory store |
| `ml_kem768` | `@noble/post-quantum` | `vi.mock` — deterministic keygen/encaps |
| `createCipheriv`, `createDecipheriv` | `crypto` | Keep real (stateless) or mock for determinism |
| `ethers` | `ethers` | `vi.mock` — mock provider, contract, wallet |
| `dagCBOR.encode` / `dagCBOR.decode` | `@ipld/dag-cbor` | `vi.mock` — JSON passthrough |
| `CID.create` | `multiformats/cid` | `vi.mock` — deterministic mock CID |
| `sha256.digest` | `multiformats/hashes/sha2` | `vi.mock` — return input bytes as digest |

## Coverage Target

- **Module coverage**: 100% of exported functions in agents/*.js
- **Line coverage**: >85% for agents/network.js, agents/ipld-logger.js, agents/pqc.js
- **Branch coverage**: >75% for conditionals (try/catch, if/else, forEach edge cases)
- **Integration paths**: All agent-role flows tested at least once
