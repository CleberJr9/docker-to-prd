# syntax=docker/dockerfile:1

ARG NODE_VERSION=22.23.2

################################################################################
# base — comum a todos os estágios. Tag pinada (sem :latest).
FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /usr/src/app
# tini: init leve p/ PID 1 — repassa SIGTERM e faz reaping de zumbis,
# garantindo que `docker stop` encerre em <10s sem cair no SIGKILL.
RUN --mount=type=cache,target=/var/cache/apk \
    apk add --no-cache tini

################################################################################
# deps — só dependências de produção. Cache mount no npm.
FROM base AS deps
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

################################################################################
# dev 
FROM base AS dev
ENV NODE_ENV=development
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci
COPY . .
EXPOSE 3000
USER node
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npm", "run", "dev"]

################################################################################
# build — compila o TypeScript (roda como root: WORKDIR é root-owned).
FROM dev AS build
USER root
RUN npm run build

################################################################################
# production 
FROM base AS production
ENV NODE_ENV=production

# npm/npx/corepack vêm embutidos na imagem base do Node, mas a imagem de
# produção nunca os invoca em runtime (só `node dist/server.js`). Remover
# reduz a superfície de ataque e some com CVEs das deps internas do npm
# (tar, glob, minimatch, sigstore, pacote, ip-address, brace-expansion).
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

# 4 labels OCI exigidas.
ARG VERSION=0.0.0
LABEL org.opencontainers.image.title="flags-api" \
    org.opencontainers.image.description="API REST de feature flags em Node.js + TypeScript com persistência em PostgreSQL" \
    org.opencontainers.image.version="${VERSION}" \
    org.opencontainers.image.source="https://github.com/CleberJr9/docker-to-prd"

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

COPY --from=deps  --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --from=build --chown=node:node /usr/src/app/dist         ./dist

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# tini como PID 1 → SIGTERM propaga → shutdown limpo em <10s.
ENTRYPOINT ["/sbin/tini", "--", "docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
