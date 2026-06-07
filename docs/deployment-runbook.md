# Deployment Runbook

## Pre-Deployment

1. Use Node.js 22 and install locked dependencies:

   ```bash
   npm ci
   npm ci --prefix frontend
   ```

2. Create `.env` from `.env.example`.
3. Store `SEPOLIA_PRIVATE_KEY` and `NETWORK_AUTH_SECRET` in the deployment
   platform's secret manager. The network secret must contain at least 32
   characters and must be identical for every agent.
4. Use dedicated persistent secret volumes for `AGENT_KEYS_DIR` and
   `AGENT_PUBLIC_KEYS_FILE`.
5. Run release gates:

   ```bash
   npm run check:secrets
   npm test
   npm run build:frontend
   ```

## Contract Deployment

```bash
npx hardhat ignition deploy ./ignition/modules/Deploy.js --network sepolia
```

Record the deployed TokenA, TokenB, and MiniDEX addresses in the deployment
secret/configuration system. Redeploy MiniDEX when its event ABI changes; the
analytics agent requires `Swapped(user, tokenIn, amountIn, amountOut)`.

## Agent Rollout

1. Deploy agents in this order: monitor, report, liquidity, analytics, deploy.
2. Confirm each agent has the same `NETWORK_AUTH_SECRET`.
3. Confirm ML-KEM public keys are present before the deploy agent sends its
   encrypted completion signal. Plaintext fallback is intentionally disabled.
4. Check liveness and readiness:

   ```bash
   curl --fail http://127.0.0.1:4101/health/live
   curl --fail http://127.0.0.1:4101/health/ready
   ```

   Ports `4101` through `4105` map to deploy, monitor, report, liquidity, and
   analytics.

5. Inspect JSON logs for `peer_connection_completed`, `broadcast_completed`,
   authentication failures, and replay detections.

## Frontend Rollout

1. Build with `npm run build:frontend`.
2. Configure and verify the three deployed contract addresses.
3. Connect a minimally funded test wallet and execute a small swap.
4. Confirm reserves and transaction history update.

## Rollback

1. Stop the affected agent or frontend deployment.
2. Restore the previous application artifact and configuration.
3. Do not roll back to a contract ABI incompatible with active agents/frontend.
4. If credentials may have leaked, rotate them before restoring service.
5. Re-run health checks and the local delivery validation test.

## Incident Checklist

- Isolate compromised hosts.
- Rotate deployment and network authentication secrets.
- Regenerate affected agent ML-KEM keys.
- Review structured logs and IPLD execution history.
- Run the secret scanner against the repository.
- Document the incident and corrective action.
