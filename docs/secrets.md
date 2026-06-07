# Secrets Management

MiniDEX reads operational secrets from the environment and generates agent
cryptographic material at runtime. Real credentials and generated private keys
must never be committed to Git.

## Required Rotation

Credentials previously committed to the repository must be considered
compromised, even after their files are removed from the current revision.

1. Revoke the exposed Infura project credential.
2. Transfer any remaining funds from the exposed Sepolia account to a new
   account.
3. Create a new, minimally funded Sepolia account for automation.
4. Replace any deployed resources that trusted the exposed account.
5. Rewrite Git history before treating the repository as private or clean.

History rewriting is disruptive and must be coordinated with every repository
consumer. Use a tool such as `git filter-repo`, then rotate credentials again
and force-push all affected branches and tags.

## Local Development

Create a local environment file from the committed template:

```bash
cp .env.example .env
```

Set the following values in `.env`:

```dotenv
RPC_URL=https://sepolia.example.invalid/v3/your-project-id
SEPOLIA_PRIVATE_KEY=your-dedicated-testnet-private-key
TOKEN_A=0x...
TOKEN_B=0x...
DEX_ADDRESS=0x...
LIQUIDITY_AMOUNT=1000
```

`SEPOLIA_PRIVATE_KEY` accepts a 32-byte hexadecimal key with or without the
`0x` prefix. Hardhat and the liquidity script both read `RPC_URL` and
`SEPOLIA_PRIVATE_KEY` from the environment. Configuration validation rejects
missing values, placeholders, invalid URLs, zero addresses, malformed private
keys, and invalid amounts.

Run the liquidity script only after configuration is complete:

```bash
node scripts/addLiquidity.js
```

## Agent Key Storage

Agents generate ML-KEM key material at runtime. The default paths are:

```dotenv
AGENT_KEYS_DIR=agents/keys
AGENT_PUBLIC_KEYS_FILE=agents/public-keys.json
```

The runtime creates secret key files with mode `0600` and the key directory
with mode `0700`. Both paths are ignored by Git.

For production, set these variables to paths backed by a secrets volume or
managed secret store. Do not bake agent key material into container images.

## CI And Repository Checks

Run the committed-secret check locally:

```bash
npm run check:secrets
```

The check fails when Git tracks:

- `.env` files other than `.env.example`
- files named as private or secret key material
- hardcoded hexadecimal private keys
- Infura project credentials
- PEM private keys
- common AWS and GitHub token formats

GitHub Actions runs this check before the test suite.
