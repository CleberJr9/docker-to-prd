# Do Dev à Produção: Containerizando a API de Feature Flags

## Sobre a entrega

Este repositório contém a containerização completa da API de feature flags (Node.js + TypeScript + PostgreSQL) em dois ambientes: desenvolvimento e produção. Um único `Dockerfile` multi-stage (`dev`, `build`, `production`) alimenta um `compose.yaml` de desenvolvimento — com `watch`, healthchecks, migração automática e um cliente de banco sob demanda — e um `compose.prod.yaml` que consome a imagem já publicada no Docker Hub, sem nenhuma etapa de build local.

A imagem de produção parte de `node:22.23.2-alpine`, roda como usuário não-root, aplica as migrações automaticamente no boot antes de subir o servidor, expõe `HEALTHCHECK` próprio e foi publicada multi-arquitetura (`linux/amd64` + `linux/arm64`) com SBOM e provenance. O código da aplicação (`src/`, `package.json`, `package-lock.json`, `tsconfig.json`, migrações) não foi alterado — toda a entrega é infraestrutura nova.

## Imagem no Docker Hub

- Repositório: https://hub.docker.com/r/clebejr/docker-to-prd
- Pull:
  ```bash
  docker pull clebejr/docker-to-prd:1.0.0
  ```
- Digest do manifest (multi-arch, tags `1.0.0` e `latest` apontam para o mesmo digest):
  ```
  sha256:86408fd0d079d388ccdcc503d3d7712af0e8db0291ccc6163b618c21965635a9
  ```
- Comparação de tamanho (`CONTENT SIZE` de `docker image ls`):

  | Imagem | Estágio | Tamanho |
  |---|---|---|
  | `flags-api:dev` | `dev` (todas as dependências) | 68.9 MB |
  | `clebejr/docker-to-prd:1.0.0` | `production` (após `docker pull --platform linux/amd64`) | 58.9 MB |

  Bem abaixo do limite de 350 MB exigido.

## Decisões técnicas

**Imagem base de produção — `node:22.23.2-alpine`.** Comparada com `node:22.23.2-slim` (base Debian): a variante Alpine usa `musl` em vez de `glibc` e um gerenciador de pacotes (`apk`) muito mais enxuto, resultando em uma imagem final significativamente menor (a `slim`/Debian costuma ficar na casa de 150–200 MB só de base, contra ~50 MB da Alpine) — decisivo para o limite de 350 MB e para reduzir a superfície de ataque. A alternativa `gcr.io/distroless/nodejs22` foi descartada por não ter shell: o `HEALTHCHECK` (que precisa rodar um `CMD` dentro do container) e o `docker-entrypoint.sh` que aplica as migrações antes do `exec` do servidor dependem de um shell mínimo (`/bin/sh`), que a Alpine oferece e a distroless não.

Como reforço adicional após a análise do Docker Scout (veja a seção de segurança), o estágio `production` remove explicitamente o `npm`/`npx`/`corepack` que vêm embutidos na imagem base do Node: a imagem final nunca invoca esses binários em runtime (só `node dist/server.js`), e removê-los elimina de vez toda a árvore de dependências internas do `npm` (que carregava vulnerabilidades próprias, sem relação com as dependências da aplicação).

**Estratégia de cache de build.** O `Dockerfile` usa `RUN --mount=type=bind` para expor `package.json`/`package-lock.json` a cada `npm ci` sem copiá-los para uma camada intermediária, e `RUN --mount=type=cache,target=/root/.npm` para persistir o cache do npm entre builds. As instruções de manifesto (`package.json`/lockfile) sempre precedem a cópia do restante do código-fonte (`COPY . .`), então uma mudança em `src/` invalida apenas a camada de cópia de código — não força reinstalação de dependências. O estágio `deps` (só dependências de produção) e o estágio `dev` (todas as dependências) partem ambos de `base` de forma independente, permitindo que o BuildKit os construa em paralelo; `build` reaproveita as camadas de `dev` (que já tem as devDependencies resolvidas) para compilar o TypeScript.

## Como rodar (desenvolvimento)

```bash
cp .env.example .env
docker compose up -d
```

A API sobe em `http://localhost:3000` com as migrações já aplicadas — `GET /flags` responde `200` sem nenhum passo manual adicional.

Para reload automático a cada mudança de código:

```bash
docker compose watch
```

Uma mudança em qualquer arquivo de `src/` é sincronizada para dentro do container sem rebuild; uma mudança em `package.json` dispara um rebuild da imagem.

Para subir o cliente de administração do banco (Adminer):

```bash
docker compose --profile tools up -d adminer
```

Disponível em `http://localhost:8081` (servidor: `db`, usuário/senha/banco: os mesmos do `.env`).

## Como rodar (produção)

```bash
cp .env.example .env
docker compose -f compose.prod.yaml up -d
```

Usa a imagem já publicada no Docker Hub (nenhum build local). A API sobe em `http://localhost:3000`, `GET /flags` responde `200`, e `docker compose -f compose.prod.yaml ps` mostra `app` e `db` como `healthy` (o healthcheck do `app` vem embutido na própria imagem).

## Segurança e supply chain

**Usuário não-root:**
```bash
docker inspect clebejr/docker-to-prd:1.0.0 --format '{{.Config.User}}'
# node
```

**Labels OCI (as 4 exigidas):**
```bash
docker inspect clebejr/docker-to-prd:1.0.0 --format '{{json .Config.Labels}}'
```
Contém `org.opencontainers.image.title`, `.description`, `.version` e `.source`.

**SBOM e provenance (attestations publicadas junto da imagem):**
```bash
docker buildx imagetools inspect clebejr/docker-to-prd:1.0.0
```
Lista os manifests `linux/amd64` e `linux/arm64` e os manifests de attestation (SBOM + provenance) de cada plataforma.

**Docker Scout — resumo (relatório completo em [`reports/scout-cves.txt`](reports/scout-cves.txt)):**

- **0 CVEs CRITICAL com correção disponível** (`docker scout cves --only-severity critical --only-fixed clebejr/docker-to-prd:1.0.0` → vazio). O achado CRITICAL inicial (Node 22.13.1 desatualizado + `tar` vendorizado pelo `npm`) foi resolvido subindo a base para `node:22.23.2-alpine` e removendo `npm`/`npx`/`corepack` da imagem final.
- **7 CVEs HIGH remanescentes**, todas no mesmo pacote de sistema **`openssl 3.5.7-r0`** (vindo da base Alpine 3.24 do Node), com correção disponível em `3.5.8-r0`: `CVE-2026-63076`, `CVE-2026-63075`, `CVE-2026-63072`, `CVE-2026-54874`, `CVE-2026-18798`, `CVE-2026-14457`, `CVE-2026-14456`.
  - **Justificativa:** a versão `3.5.8-r0` ainda não estava disponível nos repositórios do Alpine associados à tag `node:22.23.2-alpine` no momento da publicação desta entrega. Como nenhuma delas é CRITICAL e o pacote é uma biblioteca de sistema (não uma dependência direta da aplicação), o plano de mitigação é republicar a imagem assim que a próxima tag patch do Node (ou um `apk upgrade openssl` explícito no `Dockerfile`) disponibilizar a versão corrigida.
- Também há 1 MEDIUM (`CVE-2026-63074`) e 2 UNSPECIFIED (`CVE-2026-75803`, `CVE-2026-63073`), no mesmo pacote `openssl`, mesma causa e mesmo plano de mitigação acima.

## Validação

| Critério de aceite | Comando de verificação |
|---|---|
| Dockerfile único, estágios `dev`/`build`/`production` | `grep -n "^FROM" Dockerfile` |
| Nenhuma tag `latest`/omitida | inspeção manual de `Dockerfile`, `compose.yaml`, `compose.prod.yaml` |
| `.dockerignore` exclui `node_modules`, `dist`, `.git`, `.env` | `cat .dockerignore` |
| Cache mount em instalações de dependências | `grep -n "mount=type=cache" Dockerfile` |
| Build dos estágios `dev` e `production` sem erro | `docker build --target dev .` e `docker build --target production .` |
| Dev sobe sem passo manual, `/flags` 200 | `cp .env.example .env && docker compose up -d && curl -i http://localhost:3000/flags` |
| `db` com healthcheck, `app`/`migrate` com `condition: service_healthy` | `cat compose.yaml` |
| `watch`: sync em `src/`, rebuild em `package.json` | `docker compose watch` + editar `src/*` e `package.json` |
| `--profile tools` sobe Adminer em `:8081` | `docker compose --profile tools up -d adminer && curl -I http://localhost:8081` |
| `app` roda como não-root | `docker compose exec app id -u` |
| `.env` fora do git, `.env.example` versionado | `git ls-files | grep -E '^\.env'` |
| `imagetools inspect` lista `linux/amd64` e `linux/arm64` | `docker buildx imagetools inspect clebejr/docker-to-prd:1.0.0` |
| Attestations de SBOM e provenance | `docker buildx imagetools inspect clebejr/docker-to-prd:1.0.0` |
| Tags `1.0.0` e `latest` no mesmo digest | `docker buildx imagetools inspect clebejr/docker-to-prd:1.0.0 --format '{{json .Manifest.Digest}}'` (repetir para `:latest`) |
| Tamanho ≤ 350 MB após pull `amd64` | `docker pull --platform linux/amd64 clebejr/docker-to-prd:1.0.0 && docker image ls clebejr/docker-to-prd:1.0.0` |
| `User` não-root, `HEALTHCHECK`, 4 labels OCI | `docker inspect clebejr/docker-to-prd:1.0.0 --format '{{.Config.User}} {{.Config.Healthcheck}} {{json .Config.Labels}}'` |
| Container fica `healthy` com banco acessível | `docker compose -f compose.prod.yaml ps` |
| `docker stop` < 10s | `time docker stop <container>` |
| Relatório completo do Scout salvo | [`reports/scout-cves.txt`](reports/scout-cves.txt) |
| Zero CRITICAL com correção disponível | `docker scout cves --only-severity critical --only-fixed clebejr/docker-to-prd:1.0.0` |
| HIGH/CRITICAL sem correção documentadas | seção "Segurança e supply chain" acima |
| `compose.prod.yaml` sem `build`, imagem pela tag semver | `grep -c "build:" compose.prod.yaml` (→ `0`) e `grep image: compose.prod.yaml` |
| `app`/`db` com restart policy e limites de CPU/memória | `cat compose.prod.yaml` (`restart`, `deploy.resources.limits`) |
| Sem bind mount de código, dados do Postgres em volume nomeado | `docker compose -f compose.prod.yaml config --volumes` |
| Produção sobe sem passo manual, `/flags` 200, `app`/`db` healthy | `cp .env.example .env && docker compose -f compose.prod.yaml up -d && curl -i http://localhost:3000/flags && docker compose -f compose.prod.yaml ps` |
| Código da aplicação não alterado | `git diff --stat -- src/ package.json package-lock.json tsconfig.json` (vazio) |
| Nenhuma credencial hardcoded | `grep -in -E "password|secret|token" Dockerfile compose.yaml compose.prod.yaml` (só `${VAR}`) |
