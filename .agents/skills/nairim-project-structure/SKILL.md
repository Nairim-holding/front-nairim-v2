---
name: nairim-project-structure
description: Mapa da estrutura do front-nairim-v2 (arquitetura em camadas, multi-tenant, permissões, auditoria, tabelas e testes) e o passo a passo para criar ou alterar um módulo. Use antes de escrever código novo no projeto.
---

Leia isto antes de codar. Estrutura conferida em 30/10/2026; se algo aqui divergir do código, vale o código — e corrija esta skill. O `CLAUDE.md` descreve uma versão anterior (menciona `services/`, `useTableData`, `useFetchItem`, que não existem mais); não o use como mapa.

## Visão geral
Aplicação Next.js 16 (App Router) + React 19 + TypeScript, sistema de imobiliária **multi-empresa** (imóveis, proprietários, inquilinos, locações, financeiro, investimentos, ROI, reparos). Foi portada de um backend Express (`api-nairim-v2`); comentários "Origem:" nos arquivos apontam para o original. Banco PostgreSQL via Prisma 7 (`@prisma/adapter-pg`); logs de auditoria no MongoDB. Textos de interface e mensagens em português.

## Camadas (dependem só "para dentro")
```
src/app/            rotas e telas (Server Components por padrão)
src/components/     UI React (ui, form, table, charts, dashboard, domain, layout...)
src/server/         actions/ (escrita, 'use server'), queries/ (leitura, 'server-only'), services/ (regras multi-entidade)
src/core/           regra de negócio pura, SEM Prisma/Next: entities/, repositories/ (interfaces), use-cases/<modulo>/, errors/, utils/
src/infra/          implementações: repositories/ (Prisma), factories/ (composition root), auth/, database/, storage/ (MinIO), config/env.ts
src/shared/         código usado por todas as camadas: validators/ (Zod), data/, utils/, actions/action-result.ts
src/generated/prisma  cliente gerado — nunca editar à mão (`npx prisma generate`)
```
Fluxo de um módulo (exemplo Owner): `app/dashboard/(cadastro)/proprietarios/page.tsx` → `server/actions/owner.ts` (valida com `shared/validators/owner.ts`, protege com `withPermission`) → `infra/factories/owner-factory.ts` → `core/use-cases/owner/crud.ts` → `core/repositories/owners-repository.ts` (interface) → `infra/repositories/prisma-owners-repository.ts`. Leituras para Server Components ficam em `server/queries/owner.ts`.

Regras:
- `core/` nunca importa `infra/`, `server/`, `next` ou `@/generated/prisma`. Use-cases recebem repositórios por construtor e lançam erros de `core/errors/domain-errors.ts` (`ValidationError`, `NotFoundError`, `ConflictError`, `ForbiddenError`...).
- Actions retornam `ActionResult<T>` via `runAction` (`shared/actions/action-result.ts`); o cliente usa `describeActionError`.
- Todo cadastro com escrita passa por `withPermission(recurso, ação, fn)` ou `withPermissionInput` (`infra/auth/session.ts`). Só `SUPER_ADMIN` tem bypass; ADMIN não.
- Imports sempre com alias `@/`.

## Multi-empresa (crítico)
- `withTenant`/`withPermission` abrem o contexto da empresa da sessão (AsyncLocalStorage em `infra/database/tenant-context.ts`).
- `infra/database/prisma.ts` injeta `company_id` automaticamente em leituras/criações dos modelos listados em `TENANT_MODELS`. **Todo modelo novo com `company_id` precisa entrar nessa lista.** Modelos filhos sem `company_id` (ex.: `PropertyValue`, `AdjustmentIndexValue`) são isolados pelo pai — resolva o pai antes.
- Relatórios consolidados usam `infra/database/reporting-context.ts` e `infra/auth/reporting-scope.ts` (só leitura, ampliam o escopo).
- `src/middleware.ts` cuida de login, cookies `authToken`/`company_slug` e rotas `/:slug/dashboard` (rewrite em `next.config.ts`).

## Permissões
Catálogo único em `shared/utils/menu-resources.ts` (`MENU_RESOURCES`: chave, rótulo, grupo, ações, rotas). A matriz de grupos (`UserGroupPermission`) e o `withPermission` derivam dele. Recurso novo = entrada ali + uso da mesma chave nas actions/queries. O mapeamento rota→recurso do front (`Sidebar` e `PermissionGate`, em `components/layout/`) vem de `utils/permissionResource.ts`; atualize-o quando houver rota nova.

## Auditoria e logs
- Triggers do Postgres (`nairim_write_audit_log`) gravam em `AuditLogOutbox` na mesma transação; o worker (`worker/logs`) move para MongoDB (`audit_logs`) e esvazia a fila. **Não remova `AuditLogOutbox`.** Tela de Auditoria lê o Mongo.
- Tabela nova de negócio precisa de trigger de auditoria na migration (padrão em `prisma/migrations/20261013010000_property_roi`) e de rótulo em `shared/utils/audit-models.ts`.
- `withTenant` registra o autor (`runWithAuditActor`); operações sem sessão (cron) precisam informar o ator.

## Banco e migrations
- Schema: `prisma/schema.prisma` (53 modelos). Fluxo oficial: criar pasta em `prisma/migrations/<timestamp>_nome/migration.sql` à mão e aplicar com `prisma migrate deploy`. **`migrate dev` e `db push` não são usados.** Push em `main` faz deploy sem rodar migration — aplicar antes (ver `docs/correcoes-51-2026-10-21.md`).
- Antes de qualquer mudança em banco real: `npm run db:push-check` (somente leitura; aponta DROPs). Nunca remover coluna/tabela sem conferir uso no código **e** dados em produção.
- Depois de mudar o schema: `npx prisma generate` e `npm run generate:table-models` (gera `shared/data/table-transfer-models.json`, também roda no `prebuild`).
- Cada módulo de dados novo pode precisar de: `shared/data/table-transfer.ts` (exportar/importar tabelas), `shared/data/company-data-deletion.ts` (limpeza por empresa) e `table-transfer-models.json`.

## Telas e componentes
- Rotas autenticadas em `src/app/dashboard/`: grupos `(cadastro)` (administradores, grupos-usuario, imobiliarias, imoveis, indices-reajuste, inquilinos, locacoes, proprietarios, tipo-imovel) e `(financeiro)` (cartoes, categorias, centros, fornecedores, instituicoes-financeiras, investimentos, lancamentos, planejamento, relatorios, roi, financeiro-auditoria), mais `auditoria`, `configuracoes`, `empresas`, `reparos`. Públicas: `(auth)`, `[slug]/login`, `casas|imoveis/[id]`, `api/` (cep, cron, lead, logs/export, properties).
- Padrão de cadastro: `page.tsx` (lista com `components/table/DataTable`, colunas `ColumnDef` de `types/types.ts`), `cadastrar/page.tsx` e `editar|visualizar/[id]` (formulários com `components/form/DynamicForm`, `'use client'`). Fontes de dados das listas: registrar em `components/table/tableDataSources.ts`.
- `src/app/layout.tsx` é Server Component puro; todos os providers ficam em `src/app/providers.tsx` ('use client'). Nunca coloque `'use client'` no layout raiz.
- Contextos em `src/contexts/` (exportados em `index.ts`); hooks em `src/hooks/`; formatadores em `utils/formatters.ts` e máscaras em `utils/masks.ts`.
- Outros diretórios: `src/lib/` (relatórios PDF/Excel, branding, dashboard), `src/layout/DashboardLayout/` (composição do dashboard), `src/types/` (tipos de UI; entidades de domínio ficam em `core/entities`).

## Jobs e processos fora do Next
`worker/logs/` (transferência de logs para Mongo, Docker próprio) e `worker/index.js` (service worker PWA). `app/api/cron/*` expõe tarefas agendadas (hoje só `adjustment-indexes`). `scripts/` tem manutenção, seeds e testes de UI com Playwright (`test:*-ui`).

## Passo a passo: módulo novo
1. `schema.prisma` + migration SQL (com trigger de auditoria) + `prisma generate` + `generate:table-models`.
2. `core/entities/<m>.ts`, `core/repositories/<m>-repository.ts`, `core/use-cases/<m>/crud.ts`.
3. `infra/repositories/prisma-<m>-repository.ts` e `infra/factories/<m>-factory.ts`; incluir o modelo em `TENANT_MODELS`.
4. `shared/validators/<m>.ts` (Zod), `server/actions/<m>.ts`, `server/queries/<m>.ts`.
5. Recurso em `menu-resources.ts`, item no `Sidebar`, rótulo em `audit-models.ts`, registros de transferência/limpeza se aplicável.
6. Páginas em `app/dashboard/...` e fonte em `tableDataSources.ts`.
7. Testes `*.test.ts` ao lado do código (Vitest, ambiente node, só `src/**/*.test.ts`); integração com banco usa PGlite em `*.integration.test.ts`. Para segurança/tenant rode `npm run test:security`.

## Documentação por módulo
`docs/README.md` indexa uma pasta por item do menu (Resumo, Cadastrar, Locações, Financeiro, Reparos, Configurações, Auditoria) e temas em `plataforma/`. Leia o `_index.md` do módulo antes do código e registre a mudança no `changelog.md` dele. Como criar ou atualizar: `.agents/skills/docs/SKILL.md`.

## Verificação antes de entregar
`npx tsc --noEmit`, `npm run lint` (já há erros antigos de `any`; não aumente), `npm test`, e `npm run build` quando mexer em schema, rotas ou config. Não rode `db push`, `migrate dev`/`reset`/`resolve` nem push em `main` sem pedido explícito.
