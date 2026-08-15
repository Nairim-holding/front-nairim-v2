# MIGRATION_MAP.md — Mapeamento do backend `api-nairim-v2` → `front-nairim-v2` (Next.js)

> 📍 **Progresso e "onde estamos" ficam em [`MIGRATION_STATUS.md`](./MIGRATION_STATUS.md)** — leia-o primeiro ao retomar. Este arquivo é o mapa de referência; o histórico detalhado está em `CHANGELOG_MIGRATION.md`.


> **Status:** Módulos 1-13 implementados (ver `MIGRATION_STATUS.md`). Este documento ficou **desatualizado** entre a redação inicial (2026-07-16) e 2026-08-12: o inventário de endpoints abaixo (§2) não cobria `/audit-logs`, `/permissions`, `/financial-audit`, `/financial-reports`, `/user-groups` — grupos de rota reais no backend, montados e com controllers, apenas mais recentes que esta varredura original. Adicionados em §2.5 após auditoria de código. **Se for reler este mapa para planejar trabalho futuro, não assuma que §2 é exaustivo sem reconferir `api-nairim-v2/src/routes/index.ts`.**

---

## 0. Decisões aprovadas (2026-07-16)

| # | Decisão | Escolha |
|---|---|---|
| 1 | **Alvo de deploy** | **Node/Docker self-hosted** → uploads grandes, AVIF em background, backup e `AsyncLocalStorage` migram **1:1** (todos os handlers com `runtime = 'nodejs'`). |
| 2 | **Clean Architecture** | **Full** — entities + use-cases + interfaces de repositório para todos os domínios. |
| 3 | **Validação + corte do front** | **Zod** nos schemas; **repontar os 57 call sites** para `/api` relativo, módulo a módulo. |
| 4 | **E-mail de reset de senha** | **Manter como está** (sem envio real). Fica registrado como pendência de segurança no `CHANGELOG_MIGRATION.md`. |
| 5 | **Storage** | **MinIO** (é o caminho real no código: `uploadServiceFactory → CdnUploadService → MinioService`). `USE_VERCEL_BLOB` é citado no CLAUDE.md mas **não é usado no código** — será ignorado. |
| 6 | **Testes** | Backend tem `vitest`+`supertest` mas **sem arquivos de teste** → partimos do zero (Vitest no Next). |
| 7 | **Camada de apresentação** | **SSR nativo: Server Actions (mutação) + Server Components (leitura)** chamando os use-cases direto no servidor. **NÃO** usar Route Handlers `/api`. Cookie de sessão gravado no servidor via `next/headers`. |
| 8 | **Escopo do frontend** | **Refatorar o front para SSR por módulo** — ao migrar cada módulo, suas telas passam a Server Components/Actions e removem o fetch client-side + `NEXT_PUBLIC_URL_API` daquele módulo. |

>
> **Fonte analisada:** `C:\Users\Marcio\Desktop\api-nairim-v2` (Express 5 + Prisma 7) e `C:\Users\Marcio\Desktop\front-nairim-v2` (Next.js 16, App Router).
> Nada foi lido de nenhum outro repositório.

---

## 1. Visão geral do backend atual

| Item | Valor |
|---|---|
| Framework | Express **5.2** (ESM, `type: module`) |
| Runtime | Node.js (tsx em dev, `tsc` + `tsc-alias` em build) |
| ORM | **Prisma 7.2** com adapter `@prisma/adapter-pg` (PostgreSQL) |
| Auth | **JWT** (`jsonwebtoken`) + **bcrypt** |
| Multi-tenant | `AsyncLocalStorage` injeta `company_id` automaticamente nas queries Prisma |
| Upload | **Multer** (disk streaming) → **MinIO/S3** (`@aws-sdk/client-s3` + `lib-storage`), conversão **AVIF** via **Sharp** em background |
| Logging | **Pino** + `pino-http` |
| Segurança HTTP | **Helmet** + **CORS** + `express-rate-limit` |
| Porta | 5000 (frontend aponta para `http://localhost:5000` via `NEXT_PUBLIC_URL_API`) |

**Camadas:** `routes → middlewares → controllers → services → prisma`.
**Não há** repositórios/interfaces nem entidades de domínio hoje. A "regra de negócio" vive nos **Services** (26 arquivos, ~14.243 linhas no total). Prisma é acessado diretamente pelos services.

### Contagem por camada
- **26** arquivos de rotas
- **24** controllers
- **26** services (~14k linhas)
- **7** middlewares
- **~20** validadores (implementação **manual/custom**, **não** usa Zod)
- **33** models Prisma + **11** enums

---

## 2. Inventário COMPLETO de endpoints

> Wiring global em `src/routes/index.ts`:
> 1. `/auth`, `/company`, `/public/:companySlug` são registrados **antes** do auth global.
> 2. A partir de `/agencies`, tudo passa por `authenticateJWT` + `requireTenant` (JWT com `company_id` obrigatório).
> 3. `app.ts` adiciona: Helmet, CORS aberto, `express.json({limit:'4000mb'})`, static `/uploads`, rate limit global (pula rotas de upload), `/health`, error handler e 404.

### 2.1 `/auth` — público (`routes/auth.ts` → `AuthController` → `AuthService`)
| Método | Rota | Middlewares | Descrição |
|---|---|---|---|
| POST | `/auth/login` | authRateLimit, validateLogin | Login, gera JWT (payload: id, name, email, role, company_id). Retorna `company_slug`. |
| POST | `/auth/verify-token` | validateToken | Valida assinatura/expiração. |
| POST | `/auth/logout` | — | Logout (stateless). |
| POST | `/auth/refresh-token` | — | Renova JWT; tolera token expirado há < 5 min (grace period). |
| POST | `/auth/request-password-reset` | — | Gera token de reset (**e-mail NÃO é enviado — só `console.log`**; retorna o token no body ⚠️). |
| POST | `/auth/reset-password` | — | Redefine senha via token `type: password_reset`. |
| GET | `/auth/me` | authenticateToken | Usuário atual a partir do token. |
| POST | `/auth/change-password/:id` | authenticateToken | Troca senha (valida senha atual). |

### 2.2 `/company` — misto público/admin (`CompanyController`)
| Método | Rota | Auth |
|---|---|---|
| GET | `/company/branding` | público |
| GET | `/company/branding/me` | JWT + tenant |
| PUT | `/company/branding` | JWT + tenant + admin |
| POST | `/company/branding/{logo,favicon,logo-sidebar,logo-dark,og-image}` | JWT + tenant + admin + **upload single** |
| POST | `/company/switch` | JWT | Troca empresa emitindo novo JWT (sem re-login) |
| GET | `/company/check-slug/:slug` | JWT + **superAdmin** |
| GET | `/company/list` · `/company/list/filters` | JWT + superAdmin |
| GET/POST/PUT/DELETE | `/company/:id`, `/company/` | JWT + superAdmin |
| PATCH | `/company/:id/restore` | JWT + superAdmin |

### 2.3 `/public/:companySlug` — vitrine pública (`resolveCompanyBySlug` → `PublicController`)
`GET /properties/available` · `GET /properties/:id` · `GET /properties` · `GET /owners` · `GET /property-types` · `GET /agencies`
> Resolve empresa pelo slug e roda dentro do contexto de tenant (sem JWT).

### 2.4 Rotas protegidas (JWT + requireTenant global)

**`/agencies`** — GET `/` · GET `/filters` · GET `/suggestions/contacts` · GET `/:id` · POST `/` · PUT `/:id` · DELETE `/:id` · PATCH `/:id/restore`

**`/users`** — GET `/` · GET `/filters` · GET `/:id` · POST `/` · PUT `/:id` · DELETE `/:id` · PATCH `/:id/restore` · PATCH `/:id/change-password` · **PATCH `/:id/active`** · **POST `/:id/photo`** (upload) · **GET/PUT `/:id/schedule`** (jornada de acesso) — os 4 últimos são alvos de fetch cru no front (AdministradoresTable, UserPhotoField, AccessScheduleGrid), ver `MIGRATION_STATUS.md` §4.5.

**`/user-preferences`** (re-aplica authenticateJWT) — GET/POST `/column-order` · GET/POST `/dashboard-layout`

**`/owners`** — GET `/` · GET `/filters` · GET `/:id` · GET `/suggestions/contacts` · POST `/` · PUT `/:id` · DELETE `/:id` · PATCH `/:id/restore`

**`/tenants`** — GET `/` · GET `/filters` · GET `/suggestions/contacts` · GET `/:id` · POST `/` · PUT `/:id` · DELETE `/:id` · PATCH `/:id/restore`

**`/property-types`** — GET `/` · GET `/filters` · GET `/:id` · POST `/` · PUT `/:id` · DELETE `/:id` · PATCH `/:id/restore`

**`/properties`** — POST `/create-unified` · GET `/` · GET `/filters` · GET `/:id` · POST `/` · PUT `/:id` · DELETE `/:id` · PATCH `/:id/restore` · **POST/PUT `/:id/documents`** (upload multi-campo) · PUT `/update-unified/:id`

**`/leases`** — GET `/` · GET `/filters` · GET `/:id/cancellation-preview` · GET `/:id` · POST `/:id/cancel` · POST `/` · PUT `/:id` · DELETE `/:id/permanent` · DELETE `/:id` · PATCH `/:id/restore` · PUT `/:id/documents` (upload `arquivosLocacao`)

**`/dashboard`** — GET `/financial` · `/portfolio` · `/clients` · `/map` · `/all` (todas com `validateDashboardParams`)

**`/favorites`** — GET `/` · GET `/:id` · POST `/` · DELETE `/:id` · POST `/delete-by-user-property` · PATCH `/:id/restore` · GET `/user/:user_id` · GET `/check`

**`/iptu-property`** — GET `/filters` (único endpoint)

**`/planning`** (re-aplica authenticateJWT) — GET `/dashboard` · GET `/` · GET `/:id` · POST `/` · POST `/create` · PUT `/:id` · DELETE `/:id`

**`/backup`** (requireAdmin) — GET `/export` · POST `/restore` (upload JSON ≤50MB) · GET `/auto` · GET `/auto/:filename`

**`/companies`** (requireAdmin — usado pelo DataTable) — GET `/filters` · GET `/` · GET `/:id` · POST `/` · PUT `/:id` · DELETE `/:id` · PATCH `/:id/restore` · POST `/:id/branding/{logo,favicon,logo-sidebar,logo-dark,og-image}` (upload single)

#### Módulo financeiro
**`/financial-institution`** — GET `/` · `/filters` · `/balance-summary` · POST `/quick-create` · GET `/:id` · POST `/` · PUT `/:id` · DELETE `/:id` · PATCH `/:id/restore`

**`/financial-category`** — GET `/` · `/filters` · POST `/quick-create` · CRUD `/:id` + restore

**`/financial-subcategory`** — idem category

**`/financial-card`** — GET `/` · `/filters` · `/usage` · POST `/quick-create` · CRUD `/:id` + restore

**`/financial-center`** — idem category

**`/financial-supplier`** — GET `/` · `/filters` · GET `/:id` · POST `/` · POST `/quick-create` · PUT/DELETE `/:id` · restore

**`/financial-transaction`** — GET `/` · `/filters` · `/monthly-summary` · `/available-years` · `/expense-by-category` · `/subcategory-breakdown` · POST `/transfer` · POST `/installments` · POST `/recurring` · POST `/recurring/generate-next` · GET `/:id/related` · DELETE `/group/:group_id` · CRUD `/:id` + restore

**`/financial-invoice`** — GET `/` (por cardId+month+year) · POST `/` · GET `/card/:cardId` · PUT `/:id/status` · GET `/:id/transactions`

**Infra** — GET `/health` · fallback 404.

### 2.5 Grupos de rota adicionados após a varredura original (auditados e portados em 2026-08-12 — Módulo 13)

> Estes 5 grupos não estavam em §2.1-2.4 porque foram criados no backend **depois** da varredura de 2026-07-16 que originou este documento. Confirmados via leitura direta de `routes/index.ts` + controllers antes de portar — ver `MIGRATION_STATUS.md` §2.13 para o detalhe de como cada um foi implementado no front.

**`/audit-logs`** (`AuditLogController.ts`, JWT + tenant) — GET `/` · GET `/filters` · GET `/:id`. Só leitura — log é gerado pelo sistema.

**`/permissions`** (`PermissionsController.ts`, JWT + tenant) — GET `/me` (permissões resolvidas do usuário logado, consumido em **todo login** via `PermissionsContext`).

**`/financial-audit`** (`AuditController.ts`, JWT + tenant) — GET/PUT configurações de auditoria de IPTU (categorias/subcategorias de receita e despesa a considerar) · GET relatório agregado por imóvel.

**`/financial-reports`** (`ReportController.ts`, JWT + tenant) — 4 relatórios: agrupado (`grouped`), extrato, receitas×despesas (`income-expense`), demonstrativo de fluxo de caixa (`demonstrativo`). Params compartilham `startDate`/`endDate` com teto de **5480 dias** (~15 anos) — diferente do teto de 365 dias do `/dashboard`.

**`/user-groups`** (`UserGroupController.ts`, JWT + tenant) — CRUD `/` + `/:id` · PATCH `/:id/restore` · POST `/:id/clone` · GET `/resources` (catálogo estático de recursos/ações) · GET `/:id/permissions` · PUT `/:id/permissions` (substitui a matriz inteira — sem soft delete, `deleteMany`+`createMany` transacional).

**Middleware associado**: `requirePermission(resource, action)` — não documentado nas 3 linhas de `auth.ts` já listadas na tabela original de §3, adicionado aqui: `SUPER_ADMIN` sempre bypassa; resolve as permissões do usuário via grupo (`UserGroup`→`UserGroupPermission`); usuário sem grupo (ou grupo deletado) fica **sem restrição**. Portado como `withPermission()` em `infra/auth/session.ts` — ver `MIGRATION_STATUS.md` §2.13.1.

---

## 3. Middlewares (comportamento a reproduzir)

| Arquivo | Função | Observação para migração |
|---|---|---|
| `auth.ts` | `authenticateJWT`, `requireAdmin`, `requireSuperAdmin`, `requireSelfOrAdmin` | Verifica `Bearer`, decodifica em `req.user`. Roles: `administrador`/`ADMIN`/`SUPER_ADMIN`. |
| `tenant.ts` | `requireTenant` | Exige `user.company_id`; roda o handler dentro de `tenantStorage.run(company_id)`. |
| `publicTenant.ts` | `resolveCompanyBySlug` | Resolve empresa por slug e abre contexto de tenant sem JWT. |
| `authRateLimit.ts` | Bloqueio por tentativas de login | **`Map` em memória + `setInterval`** — 5 tentativas → bloqueio 5 min por `email:ip`. ⚠️ **stateful, não sobrevive a serverless multi-instância.** |
| `error.ts` | Handler global | Normaliza ValidationError, PrismaClientKnownRequestError (P2025/unique), "not found" → 404, senão 500. |
| `validation.ts` | ~24 validadores por rota | Delega para `lib/validators/*` (custom). |
| `imageProcessing.ts` | Helpers Sharp anexados ao `req` | Conversão AVIF / resize / info. |

**Multi-tenancy (crítico):** `lib/prisma.ts` estende o PrismaClient e injeta `company_id` automaticamente em `findMany/findFirst/count/aggregate/groupBy/create/createMany` para 20 models (`TENANT_MODELS`). O `company_id` vem de `getCurrentCompanyId()` (AsyncLocalStorage). **Qualquer migração precisa preservar esse contexto por request.**

---

## 4. Services (regra de negócio) — por complexidade

| Service | Linhas | Service | Linhas |
|---|---:|---|---:|
| PropertyService | 2073 | InvoiceService | 390 |
| TransactionService | 1314 | DashboardService | 353 |
| LeaseService | 977 | CardService | 346 |
| PlanningService | 845 | AuthService | 339 |
| UserService | 828 | LeaseFinanceService | 327 |
| OwnerService | 800 | DocumentService | 302 |
| AgencyService | 716 | SubcategoryService | 299 |
| TenantService | 660 | FinancialIntitucion | 282 |
| PropertyTypeService | 566 | CompanyService | 250 |
| SupplierService | 542 | PublicService | 195 |
| BackupService | 509 | CategoryService | 192 |
| FavoriteService | 437 | CenterService | 180 |
| — | — | UserPreferencesService / IptuPropertyService / TransferService | 179 / 173 / 169 |

> Detalhamento linha-a-linha de cada service será feito **no início de cada módulo** durante a migração (não antecipado aqui para evitar suposições sobre regras que precisam ser lidas no contexto de cada caso de uso).

---

## 5. Validadores (`lib/validators/*`)
`agency, auth, card, category, center, dashboard, favorite, financialIntitucion, iptu-property, lease, owner, planning, property-type, property, subcategory, supplier, tenant, transaction, user-preferences, user`.
Padrão: classes com `validateCreate / validateUpdate / validateQueryParams` retornando `{ isValid, errors }`. **Custom, sem lib.** → Proposta de migração: **reescrever em Zod** em `shared/validators`.

---

## 6. Modelo de dados (Prisma — 33 models, 11 enums na varredura original de 2026-07-16; ver nota do Módulo 13 abaixo)

**Domínios:**
- **Empresa/tenant:** `Company`, `CompanyBranding`
- **Usuário:** `User`, `UserColumnPreference`, `UserDashboardLayout`
- **Imóveis:** `Property`, `PropertyAddress`, `PropertyValue`, `PropertyIptu`, `PropertyType`, `Document`, `Favorite`
- **Partes:** `Agency`+`AgencyAddress`, `Owner`+`OwnerAddress`, `Tenant`+`TenantAddress`, `Address`, `Contact`
- **Locação:** `Lease`
- **Financeiro:** `FinancialInstitution`, `Category`, `Subcategory`, `Card`, `Center`, `Supplier`+`SupplierAddress`, `Transaction`, `Invoice`, `RecurringConfig`
- **Planejamento:** `Planning`, `PlanningMonth`

**Enums:** `Gender, Role, PropertyStatus, DocumentType, LeaseStatus, PaymentCondition, TransactionType, TransactionStatus, PaymentMode, RecurringFrequency, PlanningType`.

> **Decisão original:** O `schema.prisma` (928 linhas) é reaproveitado **integralmente** no Next.js (copiado para `prisma/schema.prisma`). É a camada `infra/database`.

> ⚠️ **Atualização 2026-08-12 (Módulo 13):** essa cópia integral **não tinha sido mantida em sincronia** — o `prisma/schema.prisma` do front ficou 6 models e vários campos atrás do schema real do backend (que o Postgres de produção já refletia). Sincronizado nesta rodada: **+6 models** (`UserAccessSchedule`, `UserGroup`, `UserGroupPermission`, `AuditLog`, `IptuAuditSettings` + enum `AuditAction`), extensão de `User` (grupo, status ativo, foto, telefone, restrição de horário, auto-relações de auditoria), e **4 colunas + 2 índices** que existiam no banco real mas nunca tinham sido declarados no schema do front (`Company.db_quota_mb`, `Agency.commission_percentage`, `Lease.agency_commission`, `Transaction.installment_group_id`) — descobertos via `prisma migrate diff` somente-leitura, ver `MIGRATION_STATUS.md` §2.13.0 para o procedimento completo. **Lição:** "reaproveitado integralmente" só vale no instante em que foi copiado — se o backend evolui depois (novos models, `migrate dev` direto na produção) e ninguém propaga pro front, o schema diverge silenciosamente. Rodar `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` periodicamente para detectar isso cedo, não só quando for portar um módulo novo.

---

## 7. Variáveis de ambiente (backend → consolidar em `ENV.md`)

| Var | Uso | Obrigatória |
|---|---|---|
| `DATABASE_URL` | Postgres | ✅ |
| `JWT_SECRET` | assinatura JWT | ✅ |
| `JWT_EXPIRES_IN` | expiração (default `8h`/`12h`) | — |
| `NODE_ENV`, `PORT`, `BASE_URL` | infra | — |
| `MINIO_ENDPOINT`, `MINIO_PUBLIC_URL`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`, `MINIO_REGION` | storage CDN | (se usar upload) |
| `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS` | rate limit | — |
| `USE_VERCEL_BLOB`, `BLOB_READ_WRITE_TOKEN` | citados no CLAUDE.md (fallback Vercel Blob) | — |

> ⚠️ **Segurança:** o `.env` do backend está com **segredos reais commitados** (`JWT_SECRET`, `BLOB_READ_WRITE_TOKEN`, credenciais Postgres). Recomendo rotacioná-los ao consolidar. **No frontend** o mesmo `BLOB_READ_WRITE_TOKEN` já aparece em `.env`.

---

## 8. Contrato de integração com o frontend (o que NÃO pode quebrar)

- Token JWT guardado no **cookie `authToken`**; empresa em cookie **`company_slug`**.
- Cliente adiciona header `Authorization: Bearer <authToken>` (`utils/authFetch.ts`); Server Components usam `lib/serverFetch.ts` (lê cookie via `next/headers`).
- **401 dispara `window 'auth:logout'`** no front.
- **51 arquivos** do front citam `NEXT_PUBLIC_URL_API` (auditado em 2026-08-12; 1 deles — `property-service.ts` — só em comentário, já migrado). **Inventário arquivo por arquivo em [`MIGRATION_STATUS.md` §4.5](./MIGRATION_STATUS.md) (seção "4.5. ⚠️ Inventário exato do que ainda depende do Express"):** dos 50 restantes, 6 fallback genérico, 8 infra cross-cutting, 3 código morto e **33 módulo de negócio real ainda em fetch cru** (formulários create/edit de 8 módulos + 5 widgets de dashboard).
- O front **já tem** `middleware.ts` (proteção de rota por cookie + slug) e **2 Route Handlers** (`/api/cep/[cep]`, `/api/lead`).

**Estratégia de corte proposta:** implementar os handlers em `/api/*` no Next e, ao final de cada módulo, repontar as chamadas (trocar base `NEXT_PUBLIC_URL_API` por caminho relativo `/api`). Alternativa: manter a base e usar `rewrites`. → **decisão a confirmar (ver §11).**

---

## 9. Arquitetura-alvo (Clean Architecture no Next.js)

```
src/
  core/
    entities/         # entidades de domínio (User, Property, Lease, Transaction, ...)
    use-cases/        # 1 caso de uso por operação (ex: LoginUseCase, CreatePropertyUseCase)
    repositories/     # INTERFACES (contratos): IUserRepository, IPropertyRepository...
    errors/           # DomainError, NotFoundError, UnauthorizedError, ValidationError...
    cryptography/     # interfaces Hasher, TokenSigner
  infra/
    config/           # env
    database/         # prisma client + schema + extensão multi-tenant (AsyncLocalStorage)
    storage/          # MinioStorage (implementa Storage) + AVIF
    repositories/     # implementações Prisma dos contratos do core
    auth/             # JwtService, BcryptHasher, session.ts (cookie via next/headers)
    security/         # login-rate-limiter
    factories/        # composition root (injeta impls nos use-cases)
  server/
    actions/          # Server Actions ('use server') = MUTAÇÕES (apresentação)
  app/
    **/page.tsx       # Server Components = LEITURA (chamam use-cases direto)
  shared/
    validators/       # schemas Zod
    validation/       # helpers de parse
    actions/          # ActionResult + mapeamento de erro para actions
```

- **Apresentação = SSR:** mutações via Server Actions (`server/actions/*`), leituras via Server Components (`app/**/page.tsx`). **Sem Route Handlers `/api`.**
- Actions/Components **não** contêm regra de negócio: validam entrada (Zod) → chamam use-case → devolvem `ActionResult` (mutação) ou dados (leitura).
- **Inversão de dependência:** use-cases dependem de `core/repositories/*` (interfaces); implementações Prisma ficam em `infra`.
- Multi-tenant preservado via `AsyncLocalStorage`, aberto por `withTenant()` (`infra/auth/session.ts`) que lê o cookie de sessão.

---

## 10. ⚠️ Riscos e limitações técnicas (exigem decisão ANTES de codar)

1. **Uploads grandes / vídeos (crítico).** Hoje: `express.json limit 4000mb`, `multer` disk-streaming, `server.timeout=0`. Route Handlers do Next têm **limites de body e timeout** dependentes da plataforma. **Na Vercel** o corpo de função serverless é limitado (~4.5MB) e há timeout máximo — **upload de vídeos grandes não roda igual.** Só é viável 1:1 em **Node self-hosted (Docker) com `runtime: 'nodejs'`** e streaming manual. → **Precisa saber o alvo de deploy.**
2. **Conversão AVIF em background (`setImmediate` fire-and-forget).** Em serverless a função "morre" após a resposta — o trabalho em background **não completa**. Alternativas: fazer síncrono, ou fila/worker externo. → decisão.
3. **Rate limit de login em memória (`Map`+`setInterval`).** Não funciona em multi-instância/serverless. → precisaria de store externo (Redis/DB) ou aceitar por-instância.
4. **Backup export/restore** lê/escreve arquivos e provavelmente roda dump longo — pode estourar timeout serverless. → confirmar alvo.
5. **AsyncLocalStorage** funciona no runtime **Node** do Next (não no Edge). Todos os handlers com tenant precisam declarar `runtime = 'nodejs'`.
6. **`e-mail de reset de senha nunca foi implementado`** (só `console.log` + token no response). Migrar "como está" mantém a falha de segurança. → definir se implementamos envio real agora.
7. **Re-arquitetura vs. port 1:1.** O backend hoje **não tem** repositories/entities. A Clean Architecture pedida é uma **reestruturação**, não cópia. Isso multiplica o esforço (envolver ~14k linhas de services em use-cases + interfaces). → confirmar profundidade desejada (ver §11).

---

## 11. Perguntas em aberto (bloqueiam decisões de arquitetura)

1. **Alvo de deploy do Next migrado:** Vercel (serverless) ou **Node/Docker self-hosted**? (Define se uploads grandes/AVIF-background/backup são viáveis 1:1.)
2. **Profundidade da Clean Architecture:** full (entities + use-cases + repository interfaces para todos os 26 domínios) ou pragmática (use-cases + services adaptados, sem duplicar entidades Prisma)?
3. **Estratégia de corte do frontend:** repontar os 57 call sites para `/api` relativo, ou manter `NEXT_PUBLIC_URL_API` + `rewrites`?
4. **Validação:** reescrever os ~20 validadores custom em **Zod** (recomendado) ou portar a implementação custom como está?
5. **E-mail de reset de senha:** implementar envio real agora (qual provedor?) ou manter comportamento atual?
6. **Storage:** manter **MinIO** ou migrar para outro (Vercel Blob / S3)? (o `.env` sugere ambos configurados)
7. **Testes:** o backend tem `vitest`+`supertest` configurado mas **não encontrei arquivos de teste** — confirmar se existem testes de referência ou se partimos do zero.

---

## 12. Ordem de migração incremental proposta (1 módulo por vez)

1. **Fundação** (infra/database + multi-tenant + auth wrappers + api-response + Zod base) — sem endpoints de negócio.
2. **Auth** (`/auth`) — login, verify, refresh, me, change/reset password.
3. **Company / Companies / Branding** (multi-tenant, upload de logo).
4. **Users** + **User-preferences**.
5. **Agencies**.
6. **Owners** · **Tenants**.
7. **Property-types** · **Properties** (o maior — 2073 linhas + upload de documentos).
8. **Leases** (+ cancelamento, documentos, finança de locação).
9. **Financeiro:** institution → category → subcategory → card → center → supplier → transaction → invoice.
10. **Planning** · **IPTU** · **Favorites**.
11. **Dashboard** (agrega vários domínios).
12. **Public** (vitrine) · **Backup**.

Cada módulo: ler services no detalhe → entities/use-cases/repos → handlers → validadores Zod → testes → atualizar `CHANGELOG_MIGRATION.md` → **parar e aguardar validação**.

---

## 13. Entregáveis (checklist do projeto)
- [x] `MIGRATION_MAP.md` (este documento)
- [ ] `ENV.md`
- [ ] `CHANGELOG_MIGRATION.md`
- [ ] Código migrado (Clean Architecture, 100% documentado, com nota de origem em cada arquivo)
- [ ] Testes unitários (use-cases) + integração (handlers)
- [ ] Lista final de funcionalidades **não** migráveis + motivos

---

*Origem deste mapeamento: varredura de `api-nairim-v2/src/**` (rotas, controllers, services, middlewares, lib, utils, prisma/schema.prisma, env) e dos pontos de integração de `front-nairim-v2/src` (authFetch, serverFetch, middleware.ts, .env).*
