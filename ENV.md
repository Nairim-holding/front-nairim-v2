# ENV.md — Variáveis de ambiente

Referência das variáveis usadas pelo `front-nairim-v2`. O modelo sem segredos é o `.env.example`; o `.env` real **não é versionado** (está no `.gitignore`). Conferido contra o código em 30/10/2026: se mudar uma variável, atualize este arquivo, `.env.example` e `src/infra/config/env.ts`.

> **Segurança:** nunca comite valores reais. Use senhas aleatórias e distintas por ambiente (produção, homologação, teste). `JWT_SECRET`, `DATABASE_URL`, credenciais do MinIO e do MongoDB devem vir de um gestor de segredos ou do `.env` do servidor. Nunca importe `src/infra/config/env.ts` em Client Components.

## Obrigatórias (a aplicação não sobe sem elas)

`src/infra/config/env.ts` lança erro no boot se faltarem.

| Variável | Uso |
|---|---|
| `DATABASE_URL` | Conexão PostgreSQL do Prisma (`prisma.config.ts` e `@prisma/adapter-pg`). |
| `JWT_SECRET` | Assinatura e verificação dos tokens de sessão. |

## Servidor (nunca expor no cliente)

| Variável | Padrão | Uso | Onde é lida |
|---|---|---|---|
| `JWT_EXPIRES_IN` | `8h` | Expiração absoluta do token de sessão (a inatividade é tratada no front). | `infra/config/env.ts`, `jwt-service.ts`, `server/actions/auth.ts` |
| `NODE_ENV` | `development` | Modo da aplicação. | `env.ts`, Dockerfile |
| `MINIO_ENDPOINT` | — | Endpoint S3 do MinIO (uploads de documentos, imagens, backups). | `infra/storage/minio-storage.ts` |
| `MINIO_PUBLIC_URL` | — | URL pública usada nos links salvos no banco. | idem |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | — | Credenciais do MinIO. | idem |
| `MINIO_BUCKET` | `imagens` | Bucket de destino. | idem |
| `MINIO_REGION` | `us-east-1` | Região S3 (exigida pelo SDK). | idem |
| `GEOAPIFY_API_KEY` | — | Geocodificação de endereço do imóvel; sem ela a sugestão de localização não funciona. | `infra/geocoding/property-suggestion.ts` |
| `CRON_SECRET` | — | Protege `/api/cron/*`; o agendador envia `Authorization: Bearer $CRON_SECRET`. Sem a variável a rota recusa a chamada. | `app/api/cron/adjustment-indexes/route.ts` |
| `MONGODB_LOGS_URI` | — | Conexão do MongoDB de logs de auditoria. | `infra/database/mongodb.ts`, worker, scripts de logs |
| `MONGODB_LOGS_DATABASE` | — | Database dos logs (`audit_logs`). Deve ser exclusivo por ambiente. | idem |

## Cliente (`NEXT_PUBLIC_*`, embutidas no build)

São resolvidas **no build** da imagem (ARG no `Dockerfile`, `deploy.yml`); alterar exige novo build.

| Variável | Uso |
|---|---|
| `NEXT_PUBLIC_URL_API` | URL da API legada (Express). Ainda usada em `app/api/lead/route.ts` e no `FetchInterceptor`; a maior parte do app já usa Server Actions. |
| `NEXT_PUBLIC_COMPANY_SLUG` | Slug padrão da empresa. |
| `NEXT_PUBLIC_COMPANY_NAME` | Nome de exibição de reserva (`layout.tsx`, `BrandingContext`, `fetchBranding`). |
| `NEXT_PUBLIC_CARTO_API_KEY` | Chave dos tiles CARTO. Sem ela o mapa mostra marca d'água e cai no OpenStreetMap. É pública por natureza; restrinja por domínio no painel do CARTO. |

## Infraestrutura de logs e Docker (não lidas pelo Next)

Usadas por `docker-compose.yml`, `docker-compose.logs.yml` e `worker/logs`. Ver `docs/auditoria/logs/operacao.md`.

| Variável | Uso |
|---|---|
| `MONGODB_LOGS_USER`, `MONGODB_LOGS_PASSWORD`, `MONGODB_LOGS_PORT` | Credenciais e porta do MongoDB de **produção** (`mongodb-logs-prod`). |
| `LOGS_WORKER_DATABASE_URL` | PostgreSQL de onde o worker lê a fila `AuditLogOutbox` (mesmo banco do `DATABASE_URL`; no Docker local use `host.docker.internal`). |
| `MONGODB_LOGS_STAGING_USER`, `MONGODB_LOGS_STAGING_PASSWORD`, `MONGODB_LOGS_STAGING_PORT` | MongoDB de teste/homologação. A senha **deve ser diferente** da de produção. |
| `MONGODB_LOGS_TEST_DATABASE`, `MONGODB_LOGS_HOMOLOG_DATABASE` | Databases de logs de teste e homologação. |
| `LOGS_WORKER_TEST_DATABASE_URL`, `LOGS_WORKER_HOMOLOG_DATABASE_URL` | PostgreSQL de cada ambiente (um worker por banco). |
| `FRONT_NAIRIM_IMAGE`, `FRONT_NAIRIM_TEST_IMAGE`, `FRONT_NAIRIM_HOMOLOG_IMAGE` | Imagens Docker de cada ambiente. |
| `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` | Administrador do serviço MinIO do compose (distintas das chaves de acesso da aplicação). |

## Scripts e testes de interface (opcionais)

Lidas só por `scripts/*.mjs`: `SEED_COMPANY_SLUG`, `SEED_ADMIN_PASSWORD`, `SEED_YEAR` (seeds), `NAIRIM_STATEMENT_ORDER_SQL`, `NAIRIM_VALIDATION_BACKUP`, `CENTER_IMPORT_REFERENCE` e variáveis `*_SCREENSHOT` (caminho de captura dos testes `test:*-ui`). Os scripts de manutenção de banco (`audit:lease-cancellations`, `logs:*`) usam `node --env-file=.env`.

## Declaradas mas sem efeito hoje

Confirmado por busca no código; não removi nada, são candidatas a limpeza.

| Variável | Situação |
|---|---|
| `BASE_URL` | Definida em `env.ts` (padrão `http://localhost:3000`), mas nenhum código lê `env.BASE_URL`. |
| `DEFAULT_DB_QUOTA_MB` | Definida em `env.ts`, sem uso: a cota agora vem só de `Company.db_quota_mb` (nulo = sem limite, ver `server/queries/dashboard-usage.ts`). |
| `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS` | Definidas em `env.ts`, sem uso: `infra/security/login-rate-limiter.ts` usa constantes próprias (5 tentativas). |
| `BLOB_READ_WRITE_TOKEN`, `MEDIA_CALLBACK_TOKEN` | Presentes no `.env` local, sem referência no código (restos do backend/Vercel Blob). |
| `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`, `EVOLUTION_DB_PASSWORD`, `EVOLUTION_PUBLIC_URL` | Presentes no `.env` local, sem referência no código nem nos compose. Confirmar com quem configurou antes de apagar. |

## Build e CI

- O `Dockerfile` recebe `DATABASE_URL` e `JWT_SECRET` apenas como **placeholders** no estágio de build (o Next importa o Prisma ao coletar rotas); os segredos reais entram em runtime pelo `.env`. O argumento `ENV_FILE` permite copiar outro arquivo (ex.: `.env.test`) para o build.
- `.github/workflows/validation.yml` usa valores falsos (`postgresql://build:build@127.0.0.1:5432/build`, `ci-placeholder-without-production-access`); não são segredos.
- `deploy.yml` repassa as `NEXT_PUBLIC_*` como build args. Push em `main` publica produção **sem** rodar migrations.

## Notas por runtime

- Todo Route Handler que ler `env`, usar Prisma multi-tenant ou `AsyncLocalStorage` deve declarar `export const runtime = 'nodejs'` (não roda no Edge). Hoje isso vale para `api/cron/adjustment-indexes` e `api/logs/export`.
- Variáveis `NEXT_PUBLIC_*` são lidas no cliente; todas as demais ficam restritas ao servidor.
