# Filecoin Storage Layer

Production-grade decentralized persistent storage for ATOS agent IPLD data on Filecoin.

## Architecture

```
Agent (IPLD Logger)
       │
       ▼
┌──────────────────┐
│  Filecoin Bridge  │  agents/filecoin-bridge.js
│   (agent-facing)  │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│   Filecoin Store  │  backend/filecoin/store.js
│  (orchestrator)   │
└──────┬───────────┘
       │
       ├──────────────────┐
       ▼                  ▼
┌──────────────┐  ┌──────────────┐
│   Storacha    │  │  Lotus RPC   │
│  (w3up API)   │  │ (Direct Deals)│
└──────────────┘  └──────────────┘
       │                  │
       ▼                  ▼
   Filecoin Network ──────┘
```

## Backend Modules

| Module | Path | Purpose |
|--------|------|---------|
| Config | `backend/filecoin/config.js` | Env-based configuration with validation |
| Client | `backend/filecoin/client.js` | Storacha & Lotus HTTP clients with retry |
| IPLD | `backend/filecoin/ipld.js` | DAG-CBOR encode/decode, integrity checks |
| Store | `backend/filecoin/store.js` | Upload/retrieve/verify orchestration with cache |
| Metrics | `backend/filecoin/metrics.js` | Prometheus-style counters, histograms, gauges |
| Middleware | `backend/filecoin/middleware.js` | Rate limiting, auth, validation |
| Routes | `backend/filecoin/routes.js` | Express REST API + server bootstrap |
| Bridge | `agents/filecoin-bridge.js` | Agent-facing backup/retrieve/verify API |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `STORACHA_TOKEN` | — | Storacha (w3up) API token |
| `STORACHA_SPACE` | — | Storacha space DID |
| `STORACHA_ENDPOINT` | `https://up.web3.storage` | Storacha upload endpoint |
| `LOTUS_API_URL` | — | Lotus JSON-RPC endpoint |
| `LOTUS_API_TOKEN` | — | Lotus API auth token |
| `DEAL_MIN_DURATION` | `518400` | Minimum deal duration (epochs) |
| `DEAL_MIN_VERIFIED` | `true` | Require verified deals |
| `FILECOIN_MAX_UPLOAD_SIZE` | `104857600` | Max upload bytes (100 MB) |
| `FILECOIN_UPLOAD_TIMEOUT_MS` | `120000` | Upload timeout |
| `FILECOIN_RETRY_ATTEMPTS` | `3` | Retry count for operations |
| `FILECOIN_RETRY_DELAY_MS` | `1000` | Base retry delay |
| `FILECOIN_API_PORT` | `4200` | REST API port |
| `FILECOIN_API_HOST` | `127.0.0.1` | REST API bind address |
| `FILECOIN_API_RATE_LIMIT_RPS` | `10` | Rate limit per IP |
| `FILECOIN_API_TOKEN` | — | Optional API auth token |
| `FILECOIN_METRICS_ENABLED` | `true` | Enable Prometheus metrics |
| `FILECOIN_CACHE_DIR` | `./.filecoin-cache` | Local cache directory |

## REST API

Base path: `/api/v1/filecoin`

### Health
```
GET /api/v1/filecoin/health
→ { status, storacha, lotus, timestamp }
```

### Store Data
```
POST /api/v1/filecoin/store
Body: <any JSON value>
→ { cid, size, storacha, lotus, status, duration, timestamp }
```

### Retrieve Data
```
POST /api/v1/filecoin/retrieve/:cid
→ { cid, data, size, status, duration, timestamp }
```

### Verify Integrity
```
POST /api/v1/filecoin/verify/:cid
Body: { filecoinCid?: string }
→ { valid, cid, filecoinCid, verifiedAt, duration, timestamp }
```

### Stats
```
GET /api/v1/filecoin/stats
→ { uploadCacheSize, retrieveCacheSize, uploadCount, retrieveCount }
```

### Status
```
GET /api/v1/filecoin/status
→ { storacha, lotus, config: { api, upload, deals } }
```

### Compute CID
```
POST /api/v1/filecoin/cid
Body: <any JSON value>
→ { cid }
```

## Agent Integration

```js
import { backupTaskToFilecoin, retrieveTaskFromFilecoin, verifyTaskBackup } from '../agents/filecoin-bridge.js'

// After any IPLD logTask call:
const cid = await logTask({...})
await backupTaskToFilecoin(cid, taskData)

// Retrieve a previously stored task:
const data = await retrieveTaskFromFilecoin(cid)

// Verify integrity:
const { valid } = await verifyTaskBackup(cid, filecoinCid)
```

## Auto-Backup (Topic Subscription)

The bridge provides `createAutoBackupHandler` that subscribes to agent topics
and automatically backs up data to Filecoin:

```js
import { createAutoBackupHandler } from './agents/filecoin-bridge.js'

const stop = createAutoBackupHandler(node, {
  autoBackup: true,
  backupTopics: ['task-completed', 'agent-report', 'audit-event']
})
// Later: stop()
```

## Frontend

The `FilecoinDashboard` component is at `frontend/src/FilecoinDashboard.jsx`.
Import it in `App.jsx` or mount as a route:

```jsx
import FilecoinDashboard from './FilecoinDashboard.jsx'

// In your router:
<Route path="/filecoin" element={<FilecoinDashboard />} />
```

## Metrics

All metrics are prefixed with `atos_filecoin_*` and exposed at the health
server `/metrics` endpoint:

| Metric | Type | Labels |
|--------|------|--------|
| `atos_filecoin_uploads_total` | Counter | `backend`, `status` |
| `atos_filecoin_retrieves_total` | Counter | `backend`, `status` |
| `atos_filecoin_upload_bytes_total` | Counter | `backend` |
| `atos_filecoin_retrieve_bytes_total` | Counter | `backend` |
| `atos_filecoin_deals_total` | Counter | `status` |
| `atos_filecoin_upload_duration_seconds` | Histogram | `backend` |
| `atos_filecoin_retrieve_duration_seconds` | Histogram | `backend` |
| `atos_filecoin_deal_duration_seconds` | Histogram | `status` |
| `atos_filecoin_storage_size_bytes` | Gauge | `backend` |
| `atos_filecoin_pending_deals` | Gauge | — |
| `atos_filecoin_active_deals` | Gauge | — |

## Development

```bash
# Start the Filecoin API server standalone:
node -e "import('./backend/filecoin/routes.js').then(m => m.startFilecoinApiServer())"

# Run with agents:
FILECOIN_API_PORT=4200 npm run agents
```

## Production Checklist

- [ ] Set `STORACHA_TOKEN` and `STORACHA_SPACE` for Storacha uploads
- [ ] Set `LOTUS_API_URL` and `LOTUS_API_TOKEN` for direct Filecoin deals
- [ ] Set `FILECOIN_API_TOKEN` to protect the REST API
- [ ] Configure `FILECOIN_API_HOST=0.0.0.0` in containerized environments
- [ ] Adjust `DEAL_MIN_DURATION` per storage requirements
- [ ] Mount `FILECOIN_CACHE_DIR` as a persistent volume
- [ ] Monitor `atos_filecoin_*` metrics in production dashboards
