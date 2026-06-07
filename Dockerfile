# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:22-bookworm-slim@sha256:7af03b14a13c8cdd38e45058fd957bf00a72bbe17feac43b1c15a689c029c732

FROM ${NODE_IMAGE} AS validation

ENV CI=true \
    NODE_ENV=development

WORKDIR /app

COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package-lock.json ./frontend/

RUN npm ci --no-audit --no-fund \
    && npm ci --prefix frontend --no-audit --no-fund

COPY . .

RUN npm run verify \
    && npx hardhat ignition deploy ./ignition/modules/Deploy.js --network hardhat

FROM ${NODE_IMAGE} AS production-dependencies

ENV NODE_ENV=production

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev --no-audit --no-fund \
    && npm cache clean --force

FROM ${NODE_IMAGE} AS runtime

ENV NODE_ENV=production \
    HEALTH_HOST=0.0.0.0 \
    LOG_LEVEL=info

WORKDIR /app

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=validation --chown=node:node /app/package.json ./package.json
COPY --from=validation --chown=node:node /app/agents ./agents
COPY --from=validation --chown=node:node /app/config ./config
COPY --from=validation --chown=node:node /app/schemas ./schemas
COPY --from=validation --chown=node:node /app/scripts/addLiquidity.js ./scripts/addLiquidity.js
COPY --from=validation --chown=node:node /app/frontend/dist ./frontend/dist

USER node

EXPOSE 4001 4002 4003 4004 4005 4101 4102 4103 4104 4105

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:4101/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["npm", "run", "agents"]
