# Dependency-setup environment for minidex-agent.

FROM node:24-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d

ENV DEBIAN_FRONTEND=noninteractive \
    CI=true \
    NODE_ENV=development \
    NPM_CONFIG_PRODUCTION=false

WORKDIR /app

COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package-lock.json ./frontend/

RUN npm ci --no-audit --no-fund \
    && npm ci --prefix frontend --no-audit --no-fund
