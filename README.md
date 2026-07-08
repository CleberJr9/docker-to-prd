# Do Dev à Produção: Containerizando uma API Node.js

## Descrição

Neste desafio você vai pegar uma aplicação Node.js + TypeScript funcional, porém sem nenhuma infraestrutura de containers, e entregar a containerização completa dela em dois ambientes: desenvolvimento e produção.

Cenário: você entrou em um time que mantém uma API REST em produção, mas todo o fluxo de trabalho roda direto na máquina de cada desenvolvedor. Sua missão é construir do zero toda a camada de containers: um ambiente de desenvolvimento produtivo, com reload automático e ferramentas de apoio, e uma imagem de produção enxuta, segura e publicada no Docker Hub com metadados de supply chain, pronta para rodar via Docker Compose de produção.

Os dois ambientes têm objetivos diferentes e isso deve se refletir nas suas decisões. O ambiente de desenvolvimento prioriza produtividade: feedback rápido, dependências completas, dados descartáveis. O ambiente de produção prioriza o mínimo: imagem pequena, superfície de ataque reduzida, rastreabilidade do que foi construído.

A entrega é puramente de containerização: o código da aplicação não deve ser alterado. Ele serve de contexto e referência.

## Objetivo

Entregar, em um repositório público no GitHub (fork do repositório base), o seguinte pacote:

- `Dockerfile` único multi-stage com os estágios `dev`, `build` e `production`
- `.dockerignore`
- `compose.yaml` do ambiente de desenvolvimento, com watch, healthchecks e profiles
- `compose.prod.yaml` do ambiente de produção, consumindo a imagem publicada no Docker Hub
- Imagem de produção publicada em repositório público no Docker Hub: multi-arch (amd64 e arm64), com SBOM e provenance, nas tags semver e `latest`
- Relatório de vulnerabilidades do Docker Scout em `reports/`
- `README.md` com instruções, evidências e comandos de validação

## Contexto

### A aplicação existente

O repositório base contém uma API REST em Node.js + TypeScript com persistência em MySQL. Características relevantes para o desafio:

- Porta configurável via variável de ambiente `PORT` (padrão 3000)
- Conexão com o banco configurável via variáveis de ambiente (host, porta, usuário, senha e nome do database)
- Endpoint `GET /health` que responde 200 quando a aplicação e a conexão com o banco estão saudáveis
- Scripts npm: `dev` (execução com reload automático), `build` (compila o TypeScript para `dist/`), `start` (executa o código compilado) e `db:migrate` (aplica as migrações de banco; idempotente)
- Tratamento de SIGTERM/SIGINT com encerramento gracioso

A aplicação não possui Dockerfile, compose, dockerignore ou qualquer arquivo de containerização. Esse vácuo é proposital: é exatamente o que você vai construir.

As migrações não rodam sozinhas. A subida de cada ambiente deve executá-las automaticamente, e a estratégia (script de inicialização, `command` no compose ou outro mecanismo) é decisão sua.

## Tecnologias obrigatórias

- Docker Engine ou Docker Desktop em versão recente, com Compose v2 e Buildx
- Buildx com builder capaz de build multi-plataforma (driver `docker-container` ou equivalente)
- Docker Scout (CLI ou via Docker Desktop)
- Conta no Docker Hub com repositório público

É proibido alterar o código da aplicação (`src/`, `package.json`, `package-lock.json`, `tsconfig.json` e migrações). Arquivos novos de containerização, como scripts de inicialização, são permitidos.

## Requisitos

### 1. Dockerfile multi-stage

Um único arquivo `Dockerfile` na raiz do projeto, com no mínimo os estágios nomeados `dev`, `build` e `production`.

Regras que valem para o arquivo inteiro:

- Nenhuma imagem base com tag `latest` ou sem tag: versões sempre fixadas
- Instalações de dependências usando cache de build (`RUN --mount=type=cache` apontando para o diretório de cache do npm)
- Ordem das instruções pensada para aproveitamento de cache entre builds (metadados de dependências copiados antes do restante do código)

Estágio `dev`:

- Instala todas as dependências, incluindo devDependencies
- Usuário não-root e `WORKDIR` definidos
- `CMD` executa a aplicação em modo desenvolvimento (script `dev`)

Estágio `build`:

- Compila o TypeScript (`npm run build`), gerando `dist/`

Estágio `production`:

- Parte de uma imagem base enxuta (a escolha é sua e deve ser justificada no README)
- Contém apenas o código compilado e as dependências de produção
- Usuário não-root
- `HEALTHCHECK` declarado na própria imagem, validando o `GET /health`
- `ENTRYPOINT`/`CMD` em exec form, garantindo que o processo Node receba sinais do sistema corretamente
- Labels OCI: `org.opencontainers.image.title`, `org.opencontainers.image.description`, `org.opencontainers.image.version` e `org.opencontainers.image.source`

### 2. Ambiente de desenvolvimento (compose.yaml)

- Serviços `app` (build do estágio `dev`) e `db` (MySQL com versão fixada), conectados por uma network nomeada declarada no arquivo
- `db` com healthcheck e `app` dependendo dele com `condition: service_healthy`
- Variáveis de ambiente carregadas de um arquivo `.env` (via `env_file` ou interpolação). O `.env.example` deve estar versionado com valores funcionais para subida local, e o `.env` deve estar no `.gitignore`
- Dados do MySQL em volume nomeado
- `develop.watch` configurado com, no mínimo: ação `sync` para mudanças em `src/` e ação `rebuild` para mudanças no `package.json`
- Serviço `adminer` (ou phpMyAdmin) disponível em `http://localhost:8081`, ativado somente pelo profile `tools`
- Migrações aplicadas automaticamente na subida do ambiente
- Fluxo do avaliador: `cp .env.example .env` seguido de `docker compose up` deve deixar a API respondendo em `http://localhost:3000`, sem nenhum passo manual adicional

### 3. Imagem de produção no Docker Hub

- Build com `docker buildx build` a partir do estágio `production`
- Manifest list contendo as plataformas `linux/amd64` e `linux/arm64`
- Build com `--sbom=true` e `--provenance=true`, com as attestations publicadas junto da imagem
- Publicada em repositório público no Docker Hub com uma tag semver (ex: `1.0.0`) e a tag `latest`, ambas apontando para o mesmo digest
- Tamanho da imagem, reportado por `docker image ls` após o `docker pull` na arquitetura amd64, menor ou igual a XX MB

### 4. Análise de vulnerabilidades (Docker Scout)

- Executar `docker scout cves` contra a imagem publicada e salvar a saída completa em `reports/scout-cves.txt`
- A imagem não pode conter nenhuma CVE de severidade CRITICAL
- CVEs de severidade HIGH remanescentes, se existirem, devem ser listadas no README com justificativa ou plano de mitigação

### 5. Ambiente de produção (compose.prod.yaml)

- Serviço `app` sem instrução `build`: usa a imagem publicada no Docker Hub, referenciada pela tag semver
- Todos os serviços com restart policy (`always` ou `unless-stopped`) e limites explícitos de CPU e memória
- Nenhum bind mount de código-fonte; dados do MySQL em volume nomeado
- Mesmo esquema de variáveis de ambiente (`.env.example` → `.env`)
- Healthchecks ativos: `docker compose -f compose.prod.yaml ps` deve exibir os serviços como `healthy`
- Fluxo do avaliador: `cp .env.example .env` seguido de `docker compose -f compose.prod.yaml up -d` deve deixar a API respondendo em `http://localhost:3000`

### 6. README

Substitua o conteúdo do `README.md` do repositório base pela documentação da sua entrega, com as seguintes seções:

- Sobre a entrega: visão geral da solução em 1 a 2 parágrafos
- Imagem no Docker Hub: link do repositório, comando `docker pull`, digest do manifest e comparação de tamanho entre a imagem `dev` e a imagem `production`
- Decisões técnicas: justificativa da imagem base de produção com comparação a pelo menos 1 alternativa considerada, e explicação da estratégia de cache de build adotada
- Como rodar (desenvolvimento): passo a passo, incluindo o uso do watch e do profile `tools`
- Como rodar (produção): passo a passo
- Segurança e supply chain: comandos para verificar usuário não-root, labels, SBOM e provenance; resumo do relatório do Scout e justificativa das CVEs HIGH remanescentes, se houver
- Validação: mapeamento de cada critério de aceite ao comando que o avaliador executa para verificá-lo

## Critérios de Aceite

A entrega é avaliada contra os critérios abaixo. Todos são obrigatórios.

Dockerfile e contexto de build

☐ `Dockerfile` único na raiz com os estágios nomeados `dev`, `build` e `production`
☐ Nenhuma imagem em `Dockerfile`, `compose.yaml` ou `compose.prod.yaml` usa tag `latest` ou omite a tag
☐ `.dockerignore` presente, excluindo no mínimo `node_modules`, `dist`, `.git` e `.env`
☐ Instalações de dependências usam `RUN --mount=type=cache`
☐ `docker build --target dev .` e `docker build --target production .` concluem sem erro

Ambiente de desenvolvimento

☐ `cp .env.example .env && docker compose up` deixa a API respondendo em `http://localhost:3000`, com migrações aplicadas, sem passos manuais adicionais
☐ `db` possui healthcheck e `app` depende dele com `condition: service_healthy`
☐ Com `docker compose watch` (ou `up --watch`), alteração em arquivo de `src/` é refletida sem rebuild e alteração no `package.json` dispara rebuild
☐ `docker compose --profile tools up -d` sobe o cliente de banco em `http://localhost:8081`
☐ `docker compose exec app id -u` retorna um UID diferente de 0
☐ `.env` não está versionado e `.env.example` está, com valores funcionais

Imagem de produção e Docker Hub

☐ `docker buildx imagetools inspect` da imagem lista `linux/amd64` e `linux/arm64`
☐ `docker buildx imagetools inspect` exibe as attestations de SBOM e provenance
☐ A tag semver e a tag `latest` apontam para o mesmo digest
☐ Após `docker pull`, `docker image ls` reporta tamanho menor ou igual a XX MB (amd64)
☐ `docker image inspect` mostra `User` não-root, `HEALTHCHECK` configurado e as 4 labels OCI exigidas
☐ Um container da imagem responde ao `GET /health` e aparece como `healthy`
☐ `docker stop` encerra o container em menos de 10 segundos, sem esperar o timeout do SIGKILL

Docker Scout

☐ `reports/scout-cves.txt` contém a saída completa do `docker scout cves` da imagem publicada
☐ Zero CVEs de severidade CRITICAL
☐ CVEs HIGH, se existirem, estão listadas e justificadas no README

Ambiente de produção

☐ `compose.prod.yaml` não contém instrução `build` e referencia a imagem do Docker Hub pela tag semver
☐ Todos os serviços têm restart policy e limites de CPU e memória
☐ Não há bind mount de código-fonte e os dados do MySQL estão em volume nomeado
☐ `cp .env.example .env && docker compose -f compose.prod.yaml up -d` deixa a API em `http://localhost:3000` e `ps` exibe os serviços como `healthy`

README

☐ Contém todas as seções obrigatórias listadas no requisito 6
☐ Inclui o link do repositório no Docker Hub e o comando `docker pull`
☐ Justifica a escolha da imagem base de produção comparando com pelo menos 1 alternativa
☐ A seção Validação mapeia os critérios de aceite aos comandos de verificação

Consistência geral

☐ O código da aplicação (`src/`, `package.json`, `package-lock.json`, `tsconfig.json`, migrações) não foi alterado
☐ Nenhuma credencial em texto plano em `Dockerfile`, nos arquivos compose ou em qualquer arquivo versionado

## Estrutura obrigatória do entregável

```
.
├── Dockerfile
├── .dockerignore
├── compose.yaml
├── compose.prod.yaml
├── .env.example
├── reports/
│   └── scout-cves.txt
├── src/                  (não alterar)
├── package.json          (não alterar)
├── package-lock.json     (não alterar)
├── tsconfig.json         (não alterar)
├── ...                   (demais arquivos da aplicação, não alterar)
└── README.md             (substituído pelo aluno)
```

Arquivos adicionais de containerização criados por você, como scripts de inicialização, podem ficar na raiz ou em uma pasta `docker/`.

## Entregável

- Repositório público no GitHub, fork do repositório base, com todo o conteúdo na branch `main`
- Repositório público no Docker Hub com a imagem de produção, com o link e o comando `docker pull` no README

## Repositório base

https://github.com/devfullcycle/REPO-A-DEFINIR

## Ordem de execução sugerida

**1.** Fork e exploração: leia os scripts do `package.json`, entenda as variáveis de ambiente esperadas e o funcionamento do `db:migrate`.

**2.** Crie o `.dockerignore` e o estágio `dev` do Dockerfile.

**3.** Monte o `compose.yaml` mínimo (app + db com healthcheck e migrações automáticas) até a API responder em `http://localhost:3000`.

**4.** Adicione o `develop.watch` e o serviço de administração de banco sob o profile `tools`.

**5.** Escreva os estágios `build` e `production` e valide localmente com `docker build --target production .`.

**6.** Crie o builder multi-plataforma no Buildx e faça o build com SBOM e provenance, publicando as duas tags no Docker Hub.

**7.** Rode o Scout contra a imagem publicada. Se houver CVE CRITICAL, ajuste a imagem base e republique. Salve o relatório em `reports/`.

**8.** Monte o `compose.prod.yaml` consumindo a imagem publicada.

**9.** Escreva o README com as evidências e a seção de validação.

**10.** Revisão final: percorra a checklist de critérios de aceite item por item antes do push final.

## Dicas finais

A ordem das instruções no Dockerfile determina o aproveitamento de cache. Copiar o `package.json` e o lockfile antes do restante do código muda drasticamente o tempo de rebuild durante o desenvolvimento.

O tamanho da imagem final é consequência das suas decisões (imagem base, multi-stage, apenas dependências de produção), não de um ajuste cosmético no fim. Se a imagem estourou o limite, revisite as decisões.

Se o Scout apontar CVEs CRITICAL, o caminho quase sempre é atualizar ou trocar a imagem base, não conviver com elas.

`docker buildx imagetools inspect` é a ferramenta para conferir plataformas, digests e attestations de uma imagem publicada sem precisar puxá-la.

Teste o fluxo do avaliador do zero: clone o seu próprio fork em uma pasta limpa, copie o `.env.example` e execute exatamente os comandos descritos no README. Se qualquer passo extra for necessário, o critério não está atendido.