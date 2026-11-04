<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Nairim (front-nairim-v2) — guia para agentes

Sistema de imobiliária **multi-empresa** em Next.js 16 (App Router), React 19, TypeScript, Prisma 7 e PostgreSQL; logs de auditoria em MongoDB. Interface e mensagens em português.

## Comece por aqui
- **Estrutura e padrões:** leia `.agents/skills/nairim-project-structure/SKILL.md` antes de codar (camadas, multi-tenant, permissões, auditoria, passo a passo de módulo novo). O `CLAUDE.md` está parcialmente desatualizado; em caso de divergência vale o código.
- **Variáveis de ambiente:** `ENV.md` (e `.env.example`). Nunca comite o `.env`.
- **Revisão de segurança:** `.agents/skills/nairim-security-review/SKILL.md`.
- **Documentação por módulo (ordem do menu):** `docs/README.md` é o índice; leia o `_index.md` do módulo antes de ler código. Para criar/atualizar, use `.agents/skills/docs/SKILL.md`. Atualize o `changelog.md` do módulo sempre que mexer nele.

## Arquitetura em uma linha
`app` (telas) → `server/actions|queries` → `infra/factories` → `core/use-cases` → `core/repositories` (interface) → `infra/repositories` (Prisma). `core/` não importa `infra/`, `next` nem o cliente Prisma.

## Regras que não podem quebrar
- Isolamento por empresa: modelo novo com `company_id` entra em `TENANT_MODELS` (`src/infra/database/prisma.ts`). Toda escrita passa por `withPermission`/`withPermissionInput` (`src/infra/auth/session.ts`).
- `src/app/layout.tsx` é Server Component; providers ficam em `src/app/providers.tsx` (`'use client'`).
- `AuditLogOutbox` é a fila de auditoria alimentada por triggers; não remover. Tabela nova de negócio leva trigger de auditoria na migration.
- Imports com alias `@/`. Não edite `src/generated/prisma` à mão.

## Banco de dados
- Migrations em `prisma/migrations/<timestamp>_nome/migration.sql`, aplicadas com `prisma migrate deploy`. **Não use** `prisma db push`, `migrate dev`, `migrate reset` ou `migrate resolve`.
- Antes de mexer em banco real rode `npm run db:push-check` (somente leitura, acusa DROPs). Não remova coluna ou tabela sem conferir uso no código **e** dados em produção.
- Após alterar o schema: `npx prisma generate` e `npm run generate:table-models`.

## Comandos
```bash
npm run dev          # servidor local (http://localhost:3000)
npx tsc --noEmit     # checagem de tipos
npm run lint         # já há erros antigos de `any`; não aumente
npm test             # Vitest (src/**/*.test.ts, integração com PGlite)
npm run test:security
npm run build        # roda generate:table-models antes (prebuild)
```

## Cuidados operacionais
- Push em `main` faz **deploy automático de produção** e não roda migrations: aplique-as antes.
- Não faça commit, push nem ações destrutivas sem pedido explícito do usuário.
- Confirme com o usuário qualquer ação em banco ou serviço real; o `DATABASE_URL` local pode apontar para um servidor compartilhado.
