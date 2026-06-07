# Project Silver Submission Checklist

## Repository Hygiene

- [x] Generated build, compiler, coverage, deployment, and frontend output is excluded.
- [x] Runtime logs, peer registries, reports, and cryptographic key material are excluded.
- [x] Local environment files are excluded; `.env.example` contains placeholders only.
- [x] Committed files pass `npm run check:secrets`.
- [x] Unused direct dependencies were removed.
- [x] Runtime and development tools used by repository scripts are declared directly.

## Reproducibility

- [x] Root dependencies install with `npm ci`.
- [x] Frontend dependencies install with `npm ci --prefix frontend`.
- [x] Local Hardhat Ignition deployment succeeds.
- [x] The production frontend build succeeds.
- [x] The complete automated test suite passes.

## Dependency Audit Note

- Production dependency audits report no high or critical vulnerabilities.
- Root and frontend production trees each retain one transitive `ethers`/`ws`
  moderate advisory. npm only offers a breaking Ethers 6 to Ethers 5 downgrade.

## Submission Commands

Run from the repository root:

```bash
npm ci
npm ci --prefix frontend
npm run verify
npx hardhat ignition deploy ./ignition/modules/Deploy.js --network hardhat
```

## Manual Review Before Submission

- [ ] Confirm the repository visibility and Project Silver submission URL.
- [ ] Confirm the default branch contains the final submission commit.
- [ ] Confirm CI and secret-scanning workflows pass on the final commit.
- [ ] Confirm any public deployment addresses and frontend URL in `README.md` are current.
- [ ] Review `docs/threat-model.md` and `docs/deployment-runbook.md`.
