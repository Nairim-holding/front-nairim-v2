# Ambientes, deploy e validação

Como o sistema é publicado e validado. Variáveis de ambiente estão em `ENV.md` (raiz).

## Ambientes
| Ambiente | Container (compose) | Banco |
|---|---|---|
| Produção | `front-nairim-app` (serviço `front-nairim`) | `nairim-postgres` |
| Teste | `front-nairim-app-test` (perfil `test`) | `nairim-postgres-test-2` (`nairim_test2_db`) |
| Homologação | `front-nairim-app-homolog` (perfil `homolog`) | `nairim-postgres-homolog` |

Cada ambiente usa **sua própria imagem Docker**, porque as variáveis `NEXT_PUBLIC_*` são resolvidas no build. Serviços de apoio: `nairim-minio` (arquivos), MongoDB de logs por ambiente e o worker de logs (`worker/logs`, ver `docs/auditoria/logs/operacao.md`).

## Deploy (`.github/workflows/deploy.yml`)
1. Push em `main` dispara a validação reutilizável (`validation.yml`).
2. Se passar, constrói uma imagem por ambiente (produção, teste, homologação) e publica no registry.
3. Conecta na VPS por SSH, faz `docker compose pull` e `up -d --force-recreate` de cada ambiente.
4. **Não roda migrations.** Aplique `prisma migrate deploy` antes de publicar uma versão que dependa delas. A imagem final não contém a CLI do Prisma nem os fontes de migração; use o checkout/contêiner de migração.

## Validação (`.github/workflows/validation.yml`, também em PRs para `main`/`iholding`)
`npm ci` → `prisma generate` → `generate:table-models` → `build:seed-test2 --check` → `tsc --noEmit` → `npm test` → teste da migration do extrato → `npm run build` → teste do seed → regressões visuais em Chromium (documentos 48 a 51) → `npm audit` (artefato `security-audit`).

Valores de `DATABASE_URL` e `JWT_SECRET` no CI são placeholders (sem acesso a banco real).

## Comandos úteis
```bash
npx tsc --noEmit
npm test
npm run test:security
npm run build
npm run db:push-check     # somente leitura: o que o db push faria no banco do .env
```
Testes de interface (Playwright): `npm run test:investments-ui`, `test:centers-ui`, `test:roi-ui`, `test:roi-detail-ui`, `test:repair-ui`, `test:table-transfer-ui`, `test:reporting-ui`, `test:correcoes51-ui`. Usam os componentes reais com sessão e ações simuladas e não tocam em banco.

## Seed do Teste 2
Passo a passo em [seed-teste2.md](seed-teste2.md) (script `scripts/seed-test2.mjs`, só aceita o banco `nairim_test2_db`).

## Migrations
- Pasta `prisma/migrations/<timestamp>_nome/migration.sql`; fluxo oficial `prisma migrate deploy`. Não usar `db push`, `migrate dev`, `migrate reset` ou `migrate resolve`.
- Antes de qualquer mudança em banco real: backup e `npm run db:push-check`.
- Migration nova de tabela de negócio inclui trigger de auditoria (padrão em `20261013010000_property_roi`).

## Histórico
### 2026-10-21 — Workflow de validação (correções 51)
Workflow reutilizável executa tipos, testes, build e regressões de interface antes de publicar as imagens da `main`; PRs para `main`/`iholding` e pushes em `iholding` também são validados.

### 2026-10-30 — Documentação inicial
