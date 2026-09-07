# ENV.md — Variáveis de ambiente (Next.js migrado)

Consolidação das variáveis do backend `api-nairim-v2` dentro do `front-nairim-v2`.
Atualizado durante o **Módulo 1 (Fundação)**. Novas variáveis serão adicionadas conforme cada módulo for migrado.

> ⚠️ **Segurança:** os valores reais estão hoje commitados no `.env` (herdado do backend). Recomenda-se **rotacionar** `JWT_SECRET`, `BLOB_READ_WRITE_TOKEN` e as credenciais do banco ao concluir a migração, e mover para um gestor de segredos em produção.

## Server-side (nunca expor no cliente)

| Variável | Obrigatória | Padrão | Uso | Origem (backend) |
|---|---|---|---|---|
| `DATABASE_URL` | ✅ | — | String de conexão PostgreSQL usada pelo Prisma. | `env.ts` |
| `JWT_SECRET` | ✅ | — | Assinatura/verificação dos JWTs de sessão e reset. | `env.ts` |
| `JWT_EXPIRES_IN` | — | `8h` (`.env` usa `12h`) | Expiração absoluta do token de sessão. | `env.ts` |
| `NODE_ENV` | — | `development` | Modo da aplicação; afeta singleton do Prisma e logs. | `env.ts` |
| `BASE_URL` | — | `http://localhost:3000` | URL base para links/compatibilidade de uploads antigos. | `env.ts` |
| `RATE_LIMIT_WINDOW_MS` | — | `300000` | Janela do rate limit de login. | `env.ts` |
| `RATE_LIMIT_MAX_REQUESTS` | — | `10000` (`.env` usa `500`) | Máx. de requisições por janela. | `env.ts` |
| `MINIO_ENDPOINT` | (upload) | — | Endpoint interno do MinIO (SDK S3). | `env.ts` / `minioService.ts` |
| `MINIO_PUBLIC_URL` | (upload) | — | URL pública (CDN) montada no link salvo no banco. | `env.ts` / `minioService.ts` |
| `MINIO_ACCESS_KEY` | (upload) | — | Credencial de acesso ao MinIO. | `env.ts` |
| `MINIO_SECRET_KEY` | (upload) | — | Credencial secreta do MinIO. | `env.ts` |
| `MINIO_BUCKET` | (upload) | `imagens` | Bucket de destino dos arquivos. | `env.ts` |
| `MINIO_REGION` | (upload) | `us-east-1` | Região S3 (formalidade para o SDK). | `env.ts` |
| `EVOLUTION_API_URL` | (WhatsApp) | — | URL interna/pública da instalação self-hosted da Evolution API. | `evolution-whatsapp-client.ts` |
| `EVOLUTION_API_KEY` | (WhatsApp) | — | Chave enviada no header `apikey` da Evolution API. | `evolution-whatsapp-client.ts` |
| `EVOLUTION_INSTANCE` | (WhatsApp) | — | Nome da instância conectada ao número remetente. | `evolution-whatsapp-client.ts` |
| `EVOLUTION_DB_PASSWORD` | (WhatsApp/Docker) | — | Senha do PostgreSQL exclusivo da Evolution API. | `docker-compose.evolution.yml` |
| `EVOLUTION_PUBLIC_URL` | (WhatsApp/Docker) | `http://localhost:8081` | Endereço público informado à Evolution; em produção, use o domínio HTTPS do serviço. | `docker-compose.evolution.yml` |
| `CRON_SECRET` | (automações) | — | Protege as rotas chamadas pelo agendador. | `/api/cron/*` |

## Client-side (já existentes no front — `NEXT_PUBLIC_*`)

| Variável | Uso |
|---|---|
| `NEXT_PUBLIC_URL_API` | Base atual da API (`http://localhost:5000`). Será repontada para `/api` conforme os módulos migram. |
| `NEXT_PUBLIC_COMPANY_SLUG` | Slug padrão da empresa (vitrine). |
| `NEXT_PUBLIC_COMPANY_NAME` | Nome de exibição da empresa. |

## Ainda no `.env` mas **não** usadas no código server-side migrado

| Variável | Situação |
|---|---|
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob — citado no CLAUDE.md do backend, mas o código real usa MinIO. Mantido por ora; candidato a remoção. |
| `MEDIA_CALLBACK_TOKEN` | Usado por fluxo de mídia do front atual; revisar no módulo de uploads. |
| `USE_VERCEL_BLOB` | Citado no CLAUDE.md do backend; **não** referenciado no código. Ignorado. |

## Notas por runtime

- Todo Route Handler que ler `env`, usar Prisma multi-tenant ou `AsyncLocalStorage` **deve** declarar `export const runtime = 'nodejs'` (não roda no Edge).
- A cobrança automática deve chamar diariamente `GET /api/cron/lease-overdue-notifications` com `Authorization: Bearer $CRON_SECRET`. Para executar às 10h de Brasília em um cron configurado em UTC, use `0 13 * * *`.
- A Evolution API precisa estar conectada antes do primeiro disparo. A aplicação usa `POST /message/sendText/{instância}` e só grava o histórico depois de uma resposta de sucesso.
- Para subir somente o WhatsApp local: `docker compose -f docker-compose.evolution.yml up -d`. O compose principal inclui essa pilha e `front-nairim` depende de `evolution-api`, portanto `docker compose up -d front-nairim` também a inicia.
