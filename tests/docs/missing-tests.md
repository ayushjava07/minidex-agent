# Missing Test List

Tests that should exist but don't yet. Organized by module.

---

## agents/network.js — 0 tests (CRITICAL)

| Test | Type | Why Needed |
|------|------|------------|
| `createAgentNode` registers correct port in registry | Unit | Core contract — every agent depends on this |
| `createAgentNode` throws on unknown role | Unit | Edge case guard |
| `createAgentNode` starts libp2p with correct config | Unit | Verifies addresses, transports, encrypters |
| `createAgentNode` registers protocol handler | Unit | Message handling must be ready |
| `connectToAllPeers` connects to all registered peers | Unit | Primary mesh function |
| `connectToAllPeers` skips self | Unit | Prevents loopback dial |
| `connectToAllPeers` returns 0 when registry empty | Unit | Graceful empty-state |
| `connectToAllPeers` handles dial failure gracefully | Unit | One peer down doesn't block others |
| `connectToAllPeers` builds correct multiaddr from registry | Integration | Port retrieval from registry is the bug vector |
| `publishMessage` sends to all connected peers | Unit | Core broadcast function |
| `publishMessage` attempts missing connections | Unit | Lazy reconnection path |
| `publishMessage` returns 0/0 when no peers | Unit | Graceful empty-state |
| `publishMessage` handles stream open failure | Unit | One bad stream doesn't block others |
| `subscribeToTopic` registers handler | Unit | Core subscription |
| `subscribeToTopic` supports multiple handlers per topic | Unit | Fan-out pattern |
| `getNetworkStatus` reports correct peer count | Unit | Status endpoint |
| `getNetworkStatus` handles disconnected state | Unit | Shows 0/4 gracefully |
| Full mesh: 5 agents create + connect + broadcast | Integration | End-to-end critical path |
| Registry-scoped isolation between test runs | Integration | No cross-test pollution |

## agents/ipld-logger.js — Missing tests for 4 of 9 exports

| Test | Type | Why Needed |
|------|------|------------|
| `getFullDAG` returns complete tree | Unit | Recursive traversal correctness |
| `getFullDAG` null on unknown CID | Unit | Edge case |
| `getFullDAG` depth limit at 10 | Unit | Infinite loop protection |
| `getNode` returns from memory then file | Unit | Cache behavior |
| `getNode` null on unknown | Unit | Edge case |
| `getTaskHistory` empty state | Unit | First-run behavior |
| `logTask` with missing fields (3 combos) | Unit | Validation |
| `logTask` with parentCID registers subtask | Unit | DAG linking |
| `logTask` generates deterministic CID | Unit | Integrity foundation |
| `logExecution` with missing fields (3 combos) | Unit | Validation |
| `verifyTaskIntegrity` valid CID | Unit | Happy path |
| `verifyTaskIntegrity` tampered data | Unit | Core security property |
| `verifyTaskIntegrity` unknown CID | Unit | Edge case |
| `escalateToHuman` updates task metadata | Unit | Side-effect correctness |
| `escalateToHuman` unknown CID is no-op | Unit | Graceful handling |
| `printDAG` unknown CID is no-op | Unit | Graceful handling |
| `printDAG` valid DAG prints tree | Unit | Output format |

## agents/pqc.js — Missing test for 1 of 4 exports

| Test | Type | Why Needed |
|------|------|------------|
| `getMyPublicKey` returns hex when keys exist | Unit | API completeness |
| `getMyPublicKey` null when no keys | Unit | Edge case |
| `encryptMessage` null when no target public key | Unit | Graceful handling |
| `encryptMessage` returns cipherText + encryptedMessage + iv | Unit | Return structure |
| `decryptMessage` throws when secret key missing | Unit | Error contract |
| `decryptMessage` decrypts own message correctly | Integration | Round-trip |
| `decryptMessage` fails on wrong cipherText | Edge case | Tamper detection |
| `generateKeys` creates keys directory | Unit | First-run behavior |
| `generateKeys` loads existing keys | Unit | Idempotency |
| `generateKeys` creates public-keys.json | Unit | Side-effect |

## agents/cid-helper.js — 0 tests (LOW — possibly dead code)

| Test | Type | Why Needed |
|------|------|------------|
| `generateCID` returns valid CID string | Unit | Core function |
| `generateCID` different output for different input | Unit | Determinism |

## Agents (workflow files) — 0 tests (FUTURE)

| File | Missing Tests |
|------|--------------|
| `deploy-agent-v2.js` | `waitForPeer` timeout, peer:connect event, main workflow, logTask calls, encryptMessage usage |
| `monitor-agent-v2.js` | `monitorPool` with various RPC responses, swap event parsing, heartbeat broadcast |
| `report-agent-v2.js` | `monitorPool` with peer states, fault detection, escalation path, backup interval cleanup |
| `liquidity-agent.js` | `checkReserveRatio`, `checkImbalanceAlert`, `suggestRebalance`, topic subscription handlers |
| `analytics-agent.js` | `fetchSwapHistory`, `calculatePoolStats`, `generateAnalyticsReport`, event queryFilter handling |

## Integration Tests — 0 tests (HIGH)

| Scenario | Why Missing |
|----------|-------------|
| Full agent mesh lifecycle | No test proves all 5 agents can discover, connect, and communicate |
| IPLD DAG: task → execution → subtask → verify | No end-to-end proof of the logging chain |
| PQC: keygen → encrypt → decrypt → round-trip | No test proves encrypted messages survive serialize/deserialize |
| Agent with simulated RPC failure | No test proves agents handle Infura/Alchemy outages |
| Concurrent agent stop/start | No test proves clean shutdown without port conflicts |

## Edge Cases — Not tested anywhere

| Case | Risk |
|------|------|
| `multiaddr()` called with `undefined` | This is THE bug in the task design — no test catches it |
| `topicHandlers` Map grows unbounded | Memory leak if topics are dynamic |
| `agentRegistry` not cleared between test runs | Cross-test pollution |
| `fs.readFileSync` throws on corrupt JSON | No try/catch in `readFile` in `ipld-logger.js` (line 29-31 does catch) |
| `process.cwd()` returns unexpected path | File persistence writes to wrong location |
| `setInterval` in report-agent not cleared | Timer leak if agent is stopped |
| Multiple `handle(PROTOCOL, ...)` calls | Only last handler wins in libp2p — no test proves this |
