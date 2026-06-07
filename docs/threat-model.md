# Threat Model

## Scope

This model covers the MiniDEX contracts, frontend, five-agent network, agent
cryptographic material, deployment credentials, and generated IPLD logs.

## Assets

- Sepolia deployment private key and funded account
- `NETWORK_AUTH_SECRET`
- Agent ML-KEM secret keys
- Token balances and liquidity-provider accounting
- Authenticated agent commands, alerts, and reports
- IPLD task and execution history

## Trust Boundaries

1. Browser and wallet: the frontend cannot protect a compromised wallet.
2. Ethereum RPC: responses and availability depend on the configured provider.
3. Agent transport: libp2p encrypts connections; application messages also
   require HMAC authentication and replay validation.
4. Host filesystem: agent keys and logs are trusted only while the host and
   mounted secret volumes remain secure.
5. CI and deployment environment: environment variables are trusted inputs.

## Primary Threats And Controls

| Threat | Control |
|---|---|
| Committed private keys | `.gitignore`, configuration validation, secret scanner |
| Plaintext deploy signal | PQC encryption fails closed when recipient key is absent |
| Forged agent message | HMAC-SHA256 authenticated envelope |
| Replay attack | Random message ID, timestamp skew check, per-agent replay cache |
| Malformed or hostile packet | Strict envelope schema, JSON complexity limits |
| Memory exhaustion from packet | Streaming byte limit via `NETWORK_MAX_MESSAGE_BYTES` |
| Unauthorized liquidity withdrawal | Per-provider liquidity accounting and tests |
| Temporary network failure | Bounded exponential retry for peer dials |
| Silent agent failure | Liveness/readiness endpoints and heartbeat failover |

## Residual Risks

- All agents currently share one network authentication secret. Compromise of
  one agent permits message impersonation until the secret is rotated.
- Replay caches are in memory and reset after process restart.
- ML-KEM public-key distribution uses a shared file and does not yet provide a
  signed key-rotation protocol.
- RPC responses are not independently verified.
- Frontend users must verify contract addresses and wallet prompts.
- Dependency audit findings require regular review and controlled upgrades.

## Security Operations

- Rotate `SEPOLIA_PRIVATE_KEY` and `NETWORK_AUTH_SECRET` after suspected exposure.
- Remove affected agents from service before rotating shared credentials.
- Preserve logs and CI artifacts for incident investigation.
- Do not restore an agent until its host and generated key material are trusted.
- Run `npm run check:secrets` and the full test suite before release.
