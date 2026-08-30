# syntax=docker/dockerfile:1

ARG NODE_VERSION=22.13.1

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
# dev — todas as dependências, código completo, reload automático.
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
