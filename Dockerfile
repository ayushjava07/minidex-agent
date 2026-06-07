FROM node:22-bookworm-slim@sha256:7af03b14a13c8cdd38e45058fd957bf00a72bbe17feac43b1c15a689c029c732

RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace/minidex-agent

COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package-lock.json ./frontend/

RUN npm ci \
    && npm ci --prefix frontend \
    && npm cache clean --force

COPY . .

RUN test -d .git \
    && npm test \
    && npm run build

CMD ["npm", "test"]
