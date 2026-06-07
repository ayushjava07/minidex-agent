# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim@sha256:7af03b14a13c8cdd38e45058fd957bf00a72bbe17feac43b1c15a689c029c732

ENV CI=true \
    NODE_ENV=development

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

COPY . .

RUN npm ci --no-audit --no-fund \
    && npm ci --prefix frontend --no-audit --no-fund \
    && npm run verify \
    && npx hardhat ignition deploy ./ignition/modules/Deploy.js --network hardhat

CMD ["npm", "test"]
