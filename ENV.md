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
