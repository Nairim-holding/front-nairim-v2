# CHANGELOG_MIGRATION.md

Histórico incremental da migração `api-nairim-v2` (Node/Express) → `front-nairim-v2` (Next.js, Clean Architecture).
Cada módulo é validado antes de seguir para o próximo. O backend **não** será desativado até tudo estar migrado, testado e aprovado.

Referência de planejamento: [`MIGRATION_MAP.md`](./MIGRATION_MAP.md). Painel de progresso ("onde estamos" + módulos que faltam): [`MIGRATION_STATUS.md`](./MIGRATION_STATUS.md).

---

## Módulo 1 — Fundação  ·  2026-07-16  ·  ✅ concluído (aguardando validação)

Base da Clean Architecture, sem endpoints de negócio. Nada do backend foi removido.

### Adicionado
- **Dependências** (`package.json`): `@prisma/client`, `@prisma/adapter-pg`, `zod`, `jsonwebtoken`, `bcryptjs`; dev: `prisma`, `tsx`, `dotenv`, `vitest`, `@types/jsonwebtoken`, `@types/bcryptjs`. Scripts `test`, `prisma:generate`, `postinstall`.
- **Prisma**: `prisma/schema.prisma`, `prisma.config.ts` e `prisma/migrations/` copiados do backend (esquema idêntico, mesmo banco). Client gerado em `src/generated/prisma` (Prisma 7.8).
- **core/errors/domain-errors.ts** — `DomainError` + `ValidationError`, `UnauthorizedError`, `InvalidCredentialsError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `TooManyRequestsError`. Substitui a inspeção de string do `middlewares/error.ts`.
- **core/cryptography/hasher.ts** — interface `Hasher` (contrato de bcrypt).
- **core/cryptography/token-signer.ts** — interface `TokenSigner` + tipos de payload do JWT.
- **infra/config/env.ts** — validação de env server-side (porte de `src/env.ts`).
- **infra/database/tenant-context.ts** — `AsyncLocalStorage` de `company_id` (porte de `lib/tenantContext.ts`).
- **infra/database/prisma.ts** — client Prisma estendido com injeção automática de `company_id` (porte de `lib/prisma.ts`), singleton global.
- **infra/auth/bcrypt-hasher.ts** — implementação de `Hasher`.
- **infra/auth/jwt-service.ts** — implementação de `TokenSigner`.
- **shared/http/api-response.ts** — formato de resposta idêntico ao backend + helpers `jsonOk`/`jsonError`.
- **shared/http/error-handler.ts** — `toErrorResponse` (DomainError/Zod/Prisma → HTTP).
- **shared/http/guards.ts** — wrappers de rota `publicRoute`, `authRoute`, `tenantRoute`, `adminRoute`, `superAdminRoute` (substituem `authenticateJWT`/`requireTenant`/`requireAdmin`/`requireSuperAdmin`).
- **shared/validation/parse.ts** — helpers Zod (`parseOrThrow`, `parseJsonBody`, `parseQuery`).
- **Docs**: `ENV.md`, este `CHANGELOG_MIGRATION.md`, e `MIGRATION_MAP.md` atualizado com as decisões.

### Decisões técnicas
- **bcrypt → bcryptjs**: substituição por JS puro (evita build nativo no Windows/Docker). Formato de hash idêntico — senhas existentes continuam válidas.
- **Runtime Node**: handlers que usam tenant/env/Prisma exigirão `runtime = 'nodejs'` (AsyncLocalStorage não roda no Edge).
- **Schema Prisma reutilizado integralmente** — é a camada `infra/database`.

### Pendências / dívidas registradas
- 🔒 E-mail de reset de senha **não** é enviado (mantido como no backend — decisão aprovada). Endpoint retornará mensagem genérica; token não deve ser exposto em produção (rever no Módulo Auth).
- 🔒 Segredos reais commitados no `.env` — rotacionar ao final.

### Validação
- `prisma generate` OK (Prisma 7.8).
- `npx tsc --noEmit` → **0 erros** (projeto inteiro; nenhuma regressão introduzida).

### Não migrado ainda (próximos módulos)
- Todos os endpoints de negócio. Próximo: **Módulo 2 — Auth** (`/auth/*`).

---

## Módulo 2 — Auth  ·  2026-07-16  ·  ✅ concluído (aguardando validação)

> **Nota de arquitetura:** este módulo foi **refeito** após decisão de usar **SSR nativo (Server Actions + Server Components)** em vez de Route Handlers `/api`. Os Route Handlers `src/app/api/auth/*` e os wrappers HTTP (`shared/http/*`) foram **removidos**; a lógica de core/infra permaneceu intacta. Ver decisões #7/#8 no MIGRATION_MAP.

Migração completa de `/auth/*` como **Server Actions**. O JWT emitido pelo Next usa o **mesmo `JWT_SECRET` e payload** do backend, então continua válido para as rotas ainda servidas pelo Express durante a coexistência. O cookie de sessão (`authToken`) é gravado **no servidor** via `next/headers`.

### Server Actions (`src/server/actions/auth.ts`, `'use server'`)
| Action | Origem (backend) |
|---|---|
| `loginAction` | routes/auth.ts + authRateLimit + AuthController.login |
| `refreshSessionAction` | AuthController.refreshToken (grace 5 min) |
| `logoutAction` | AuthController.logout |
| `changePasswordAction` | AuthController.changePassword |
| `requestPasswordResetAction` | AuthController.requestPasswordReset |
| `resetPasswordAction` | AuthController.resetPassword |

Leitura (verify/me) é feita por `infra/auth/session.ts` → `getServerSession()` / `requireSession()` para uso em Server Components (substitui `/auth/verify-token` e `/auth/me`).

### Adicionado (Clean Architecture)
- **core/entities/user.ts** — `User`, `UserCredentials`.
- **core/repositories** — `UsersRepository`, `CompaniesRepository` (interfaces).
- **core/use-cases/auth/** — `LoginUseCase`, `VerifyTokenUseCase`, `RefreshTokenUseCase`, `GetCurrentUserUseCase`, `ChangePasswordUseCase`, `RequestPasswordResetUseCase`, `ResetPasswordUseCase`.
- **infra/repositories** — `PrismaUsersRepository`, `PrismaCompaniesRepository`.
- **infra/security/login-rate-limiter.ts** — porte do `authRateLimit` (in-memory).
- **infra/auth/session.ts** — sessão SSR: cookie via `next/headers`, `getServerSession`/`requireSession`/`assertAdmin`/`assertSuperAdmin`/`withTenant`/`getRequestIp` (substitui os middlewares `authenticateJWT`/`requireTenant`/`requireAdmin`/`requireSuperAdmin`).
- **infra/factories/auth-factory.ts** — composition root (DI).
- **shared/validators/auth.ts** — schemas Zod.
- **shared/actions/action-result.ts** — `ActionResult` + mapeamento de erro (DomainError/Zod/Prisma) para actions.

### Comportamento preservado (verificado por teste)
- Login mapeia papel no **token** (`ADMIN→administrador`) mas mantém papel bruto no objeto `user`; inclui `company_slug`; grava cookie de sessão no servidor.
- Credenciais inválidas → `{ ok:false, message:'Email ou senha incorretos', rateLimit: status }`.
- Rate limit: 5 falhas → bloqueio 5 min.
- Refresh com grace period de 5 min; reset de senha valida `type: 'password_reset'`.

### Frontend refatorado para SSR (decisão: Server Actions + Server Components)
- `src/app/(auth)/login/LoginFormWrapper.tsx` → chama `loginAction` (sem fetch HTTP).
- `src/contexts/AuthContext.tsx` → `refreshSessionAction` (sem fetch HTTP).
- (Demais 55 call sites seguem no Express via `NEXT_PUBLIC_URL_API` até seus módulos migrarem para SSR.)

### Testes
- `src/core/use-cases/auth/__tests__/` — **16 testes** (login, verify, refresh, me, change/request/reset password) — todos passando.
- `vitest.config.ts` adicionado (alias `@` → `src`).

### Validação
- `npx tsc --noEmit` → **0 erros**.
- `npx vitest run` → **16/16 passando**.
- ⏳ **Validação end-to-end pendente**: exige `next dev` rodando com o Postgres acessível (login real no navegador). Recomendo fazer isso antes de aprovar o módulo.

### Limitações / dívidas
- 🔒 Reset de senha continua sem envio de e-mail (decisão aprovada) — token retornado no resultado da action; não usar em produção assim.
- ⚠️ `login-rate-limiter` é in-memory (ok para instância única; ver nota no arquivo).
- ⚠️ Cookie `authToken` mantido **não-httpOnly** durante a coexistência (o `authFetch` client-side ainda precisa lê-lo para os módulos no Express). Endurecer para httpOnly quando tudo for SSR.

### Próximo
- **Módulo 3 — Company / Companies / Branding** (multi-tenant + upload de logo), em SSR.

---

## Módulo 3 — Company / Companies / Branding  ·  2026-07-16  ·  ✅ concluído (aguardando validação)

Migração da lógica de `/company/*` e `/companies/*` em SSR + refatoração das telas admin. Restam apenas dependências **compartilhadas** (AssetUploader/SSE e DataTable), que serão migradas nos seus próprios módulos.

### Adicionado (Clean Architecture)
- **core/entities/company.ts** — `Company`, `CompanyBranding`, `BrandingData`, `BRANDING_FIELDS`, `CompanyWithBranding`, `PublicBranding`, `CompanyListResult`.
- **core/storage/storage.ts** — interface `Storage` + `UploadInput`.
- **core/repositories/companies-repository.ts** — interface expandida (slug, branding, CRUD).
- **core/use-cases/company/** — `branding.ts` (GetPublicBranding, GetMyBranding, UpdateBranding, UploadBrandingAsset), `crud.ts` (CheckSlug, List, GetById, Create, Update, Delete, Restore), `switch-company.ts` (SwitchCompany → novo JWT).
- **infra/storage/minio-storage.ts** — `Storage` sobre MinIO/S3 (PutObject/DeleteObject).
- **infra/repositories/prisma-companies-repository.ts** — implementação completa + cache de branding (60s, invalidação em update/upload).
- **infra/factories/company-factory.ts** — composition root.
- **shared/validators/company.ts** — `pickBrandingFields`, `switchCompanySchema`, `listCompaniesQuerySchema`.
- **server/actions/company.ts** (`'use server'`) — `updateBrandingAction`, `uploadOwnBrandingAssetAction`, `uploadCompanyBrandingAssetAction`, `switchCompanyAction` (regrava cookie), `createCompanyAction`, `updateCompanyAction`, `deleteCompanyAction`, `restoreCompanyAction`.
- **server/queries/company.ts** — `getPublicBrandingData`, `getMyBrandingData`, `checkSlugAvailabilityData`, `listCompaniesData`, `getCompanyByIdData`, `getCompanyFiltersData` (guardas de permissão embutidas).
- **AWS SDK S3** (`@aws-sdk/client-s3`) + `server-only` adicionados às deps.

### Front refatorado para SSR (telas do módulo)
Todos passaram a consumir Server Actions/queries (sem `NEXT_PUBLIC_URL_API`):
- `src/lib/fetchBranding.ts` → `getPublicBrandingData()` (tema/branding público em `generateMetadata`).
- `src/components/admin/WhiteLabel/WhiteLabelManager.tsx` → `getMyBrandingAction` (load) + `updateBrandingAction` (save).
- `src/app/dashboard/empresas/cadastrar/page.tsx` → `checkSlugAction` + `createCompanyAction`.
- `src/app/dashboard/empresas/editar/[id]/page.tsx` → `getCompanyByIdAction` + `checkSlugAction` + `updateCompanyAction`.
- `src/app/dashboard/empresas/visualizar/[id]/page.tsx` → `getCompanyByIdAction`.
- Actions de leitura para uso client-side: `getMyBrandingAction`, `getCompanyByIdAction`, `checkSlugAction`.

### Comportamento preservado (coberto por teste — 16 testes)
- Slug normalizado (lowercase/trim); conflito de slug → 409; empresa inexistente → 404.
- Upload valida imagem + limite (5MB logos/favicon, 10MB OG).
- Switch de empresa emite novo JWT com o `company_id` destino (empresa ativa).
- Filtros do DataTable e formato flat da listagem preservados.

### Decisões / notas
- `/company/*` (super admin) e `/companies/*` (admin) apontam para a MESMA lógica; as actions de CRUD usam guarda **admin** (super admin é admin) — fiel ao efeito do backend, onde admins já gerenciavam via `/companies`.
- `Company`/`CompanyBranding` não são tenant-scoped → queries rodam sem filtro de empresa (login/branding/switch funcionam fora de contexto).

### ⏳ Ainda no Express (dependências compartilhadas — migram nos seus módulos)
Não são específicas do Company; ficam para os módulos donos:
- **`AssetUploader.tsx`** (uploads de branding `POST /company/branding/{logo,...}`) — usa `useUploadSSE` (progresso via SSE) e é componente **compartilhado** com Imóveis. Migra no **módulo de Uploads/Imóveis**. Enquanto isso, os uploads seguem funcionando via Express.
- **`DataTable`** (listagem/删除/restore de empresas via `resource="companies"`) e **`DynamicFormManager`** (carga de dados no modo edit) — componentes **cross-cutting** usados por todos os recursos. Migram no seu próprio passo de infra de UI.

### Validação
- `npx tsc --noEmit` → **0 erros** · `npx vitest run` → **32/32 passando** (16 auth + 16 company).
- ⏳ End-to-end (branding/empresas no navegador) requer `next dev` + Postgres.

### Próximo
- **Módulo 4 — Users / User-preferences** (SSR).

---

## Módulo 4 — Users / User-preferences  ·  2026-07-17  ·  ✅ concluído (aguardando validação)

Migração de `/users/*` e `/user-preferences/*` em SSR. **Todos** os call sites de preferências do front saíram do Express.

### Server Actions (`src/server/actions/`)
| Action | Origem (backend) |
|---|---|
| `createUserAction` | POST /users |
| `updateUserAction` | PUT /users/:id (só SUPER_ADMIN altera `role`) |
| `deleteUserAction` | DELETE /users/:id (soft-delete + libera e-mail) |
| `restoreUserAction` | PATCH /users/:id/restore |
| `changeUserPasswordAction` | PATCH /users/:id/change-password |
| `listUsersAction` · `getUserByIdAction` · `getUserFiltersAction` | GETs de /users (expostos para Client Components) |
| `getColumnPreferencesAction` · `saveColumnPreferencesAction` | GET/POST /user-preferences/column-order |
| `getDashboardLayoutAction` · `saveDashboardLayoutAction` | GET/POST /user-preferences/dashboard-layout |

### Queries (`src/server/queries/`) — para Server Components
`listUsersData`, `getUserByIdData`, `getUserFiltersData`, `getColumnPreferencesData`, `getDashboardLayoutData`.

### Adicionado (Clean Architecture)
- **core/entities/user.ts** — `UserProfile`, `GENDERS`/`ROLES`, `CreateUserData`, `UpdateUserData`, `ListUsersParams`, `PaginatedUsers`.
- **core/entities/user-preferences.ts** — `ColumnPreferences`, `DashboardLayout(+Item)`, inputs.
- **core/repositories/users-repository.ts** — **segregada** em `AuthUsersRepository` (auth, sem tenant) e `UsersRepository extends AuthUsersRepository` (módulo Users, com tenant).
- **core/repositories/user-preferences-repository.ts** — novo contrato.
- **core/use-cases/user/crud.ts** — List, GetFilters, GetById, Create, Update, Delete, Restore.
- **core/use-cases/user-preferences/preferences.ts** — get/save de colunas e layout.
- **infra/repositories/prisma-users-repository.ts** — porte completo de `UserService`: busca em memória ignorando acentos, ordenação pt-BR, filtros (texto/enum/data com range), filtros contextuais do DataTable.
- **infra/repositories/prisma-user-preferences-repository.ts** — upsert por `user_id+resource`, datas em ISO.
- **infra/factories/user-factory.ts** — composition root.
- **shared/validators/user.ts** / **user-preferences.ts** — schemas Zod (idade ≥ 16, senha ≥ 6, colunas únicas, layout válido, etc.).

### Comportamento preservado (coberto por 13 testes)
- Senha hasheada; role padrão `DEFAULT`; e-mail único (409) na criação e na edição.
- Soft-delete renomeia o e-mail para `ex_<ts>_<email>`, liberando o original.
- Restore: 404 se não existe, 400 se não está excluído; e-mail permanece `ex_...`.
- **Apenas SUPER_ADMIN altera `role`** (403 caso contrário).
- `/users` exige apenas autenticação + empresa (sem admin) — igual ao backend.

### Front refatorado para SSR
- `src/hooks/useDashboardLayout.ts` → `get/saveDashboardLayoutAction`.
- `src/components/table/DataTable/index.tsx` → `get/saveColumnPreferencesAction` (**só as preferências**; a carga de dados do recurso continua no Express).
- `src/app/dashboard/(financeiro)/lancamentos/page.tsx` → `get/saveColumnPreferencesAction`.
- As telas de `administradores` (users) usam `DataTable`/`DynamicFormManager` com `resource="users"` — migram junto do passo de infra de UI.

### Notas
- 🧹 **`src/hooks/useTableData.ts` é código morto** (não é importado em lugar nenhum) e ainda aponta para `${NEXT_PUBLIC_URL_API}/users`. Candidato a remoção — deixei intacto para você decidir.
- Preferências são sempre do usuário da sessão (`session.id`), nunca de um id vindo do cliente — igual ao backend.

### Validação
- `npx tsc --noEmit` → **0 erros** · `npx vitest run` → **45/45 passando** (16 auth + 16 company + 13 user).
- ⏳ End-to-end pendente (requer `next dev` + Postgres).

### Próximo
- **Módulo 5 — Agencies** (SSR) ou a infra de UI compartilhada (DataTable/DynamicFormManager) — a definir.

---

## Módulo 5 — Agencies (Imobiliárias)  ·  2026-07-17  ·  ✅ concluído (aguardando validação)

Migração de `/agencies/*` em SSR. Primeiro módulo com **endereço + contatos** (molde para Owners/Tenants/Suppliers).

### Server Actions (`src/server/actions/agency.ts`)
`createAgencyAction` · `updateAgencyAction` · `deleteAgencyAction` · `restoreAgencyAction` + leituras `listAgenciesAction` · `getAgencyByIdAction` · `getAgencyFiltersAction` · `getAgencyContactSuggestionsAction`.

### Queries (`src/server/queries/agency.ts`)
`listAgenciesData` · `getAgencyByIdData` · `getAgencyFiltersData` · `getContactSuggestionsData` (guarda `withTenant`).

### Adicionado (Clean Architecture)
- **core/entities/agency.ts** — `Agency`, `CreateAgencyData`, `UpdateAgencyData`, inputs de contato/endereço, `ListAgenciesParams`, `PaginatedAgencies`, `ContactSuggestion`.
- **core/repositories/agencies-repository.ts** — contrato.
- **core/use-cases/agency/crud.ts** — List, GetFilters, GetContactSuggestions, GetById, Create, Update, Delete, Restore.
- **infra/repositories/prisma-agencies-repository.ts** — porte completo do `AgencyService`: busca em memória (direto+endereço+contato, acentos ignorados), ordenação direta/relacional pt-BR, filtros (direto/endereço/contato/data), **create/update em `$transaction`** (contatos e endereços aninhados, soft-delete+recriação na edição), filtros contextuais e sugestões de contato deduplicadas.
- **infra/factories/agency-factory.ts** — composition root.
- **shared/validators/agency.ts** — Zod (CNPJ 14 dígitos, obrigatórios, e-mail de contato).

### Comportamento preservado (12 testes)
- CNPJ único (409) na criação e edição; 404/400 em get/delete/restore; soft-delete e restore cascateiam para os contatos.
- `create`/`update` transacionais; na edição, contatos/endereços enviados **substituem** os atuais (soft-delete + recria).

### Front refatorado para SSR
- `imobiliarias/cadastrar/CadastrarImobiliariaForm.tsx` → `createAgencyAction`.
- `imobiliarias/editar/[id]/EditarImobiliariaForm.tsx` → `updateAgencyAction`.
- Ficam no Express (dependências de outros módulos): dropdowns de `/agencies?limit=1000` em **locações** e **imóveis** (migram nesses módulos); dropdowns financeiros em `_lib/agencyFinancialOptions.ts` (módulo Financeiro); carga do form no modo edit (via `DynamicFormManager`); `/api/cep` é route handler próprio do front (mantido).

### Notas / dívidas
- ⚠️ **Sugestões de contato (`getAvailableContacts`) não filtram por empresa** — comportamento herdado do backend (`Contact` não é tenant-scoped). Preservado; rever se for exigido isolamento por tenant.

### Validação
- `npx tsc --noEmit` → **0 erros** · `npx vitest run` → **57/57 passando** (16 auth + 16 company + 13 user + 12 agency).
- ⏳ End-to-end pendente (requer `next dev` + Postgres).

### Próximo
- **Módulo 6 — Owners · Tenants** (mesmo molde de endereço+contatos).

---

## Módulo 6 — Owners · Tenants (Proprietários · Inquilinos)  ·  2026-07-17  ·  ✅ concluído (aguardando validação)

Migração de `/owners/*` e `/tenants/*` em SSR, reaproveitando o molde de endereço+contatos do Módulo 5 (Agency).

### ⚠️ Achado de fidelidade — divergência real entre os dois services do backend
Investigação comparativa (Owner vs Tenant) revelou que o **TenantService não é simétrico ao OwnerService**, apesar de UI/validador parecerem iguais:
- **Owner**: PF (`cpf`) e PJ (`cnpj`) são **mutuamente exclusivos** — o service zera os campos do lado oposto no create/update.
- **Tenant**: **NÃO há exclusão mútua** no service — todos os campos (`cpf`, `cnpj`, `rg`, `nationality`, `occupation`, `marital_status`, `state_registration`, `municipal_registration`) são gravados exatamente como recebidos. O front (`cadastrar`/`editar` de inquilinos) já monta o payload fazendo o nulling no cliente, mas o backend aceitaria ambos preenchidos se enviados.
- **Tenant.deleteTenant** não verifica existência antes de excluir (erro cru do Prisma/P2025 em vez de mensagem customizada); **Owner.deleteOwner** verifica e lança mensagem amigável.
- Tenant tem 4 campos exclusivos (`nationality`, `rg`, `rg_issuing_body`, `rg_issuing_state`) que **não aparecem em `getTenantFilters`** nem no `FIELD_MAPPING` (gap herdado do legado — persistidos mas não filtráveis).
- `getTenantById` traz `leases` **raso** (sem includes aninhados); `getOwnerById` traz `properties`+`leases` com includes profundos.

**Decisão de migração:** preservar os dois comportamentos exatamente como estão (regra de ouro — não inventar/harmonizar sem aprovação). Documentado em comentários nos arquivos (`core/entities/tenant.ts`, `core/use-cases/tenant/crud.ts`, `infra/repositories/prisma-tenants-repository.ts`).

### Server Actions
- `src/server/actions/owner.ts` — create/update/delete/restore + leituras (list, getById, getFilters, getContactSuggestions).
- `src/server/actions/tenant.ts` — idem, para Tenant.

### Adicionado (Clean Architecture)
- **core/entities**: `owner.ts`, `tenant.ts` (com os campos extras de Tenant documentados).
- **core/repositories**: `owners-repository.ts`, `tenants-repository.ts`.
- **core/use-cases**: `owner/crud.ts` (com nulling PF/PJ replicado fielmente), `tenant/crud.ts` (sem nulling, delete sem checagem prévia — comentado).
- **infra/repositories**: `prisma-owners-repository.ts` (com includes profundos de properties/leases), `prisma-tenants-repository.ts` (leases raso; `searchFields` incompleto preservado de propósito).
- **infra/factories**: `owner-factory.ts`, `tenant-factory.ts`.
- **shared/validators/br-documents.ts** — `isValidCPF`/`isValidCNPJ` (porte exato do algoritmo com dígito verificador, compartilhado entre os dois módulos e reutilizável em outros que usem PF/PJ).
- **shared/validators**: `owner.ts` (schema com `superRefine` replicando a exclusão mútua PF/PJ), `tenant.ts` (schema exige CPF ou CNPJ mas SEM exclusão mútua, fiel ao TenantValidator).

### Comportamento preservado (28 testes novos: 12 owner + 11 tenant + 5 CPF/CNPJ)
- internal_code/CPF/CNPJ únicos (409) em ambos; Owner zera campos opostos, Tenant não.
- CPF/CNPJ com dígito verificador correto (casos válidos e inválidos testados).
- Delete: Owner 404 amigável se não existir; Tenant propaga erro do repositório (sem checagem prévia) — comportamento intencionalmente divergente, testado nos dois sentidos.

### Front refatorado para SSR
- `proprietarios/cadastrar/page.tsx` → `listOwnersAction` (código interno automático) + `createOwnerAction`.
- `proprietarios/editar/[id]/page.tsx` → `updateOwnerAction`.
- `inquilinos/cadastrar/page.tsx` → `listTenantsAction` (código interno automático) + `createTenantAction`.
- `inquilinos/editar/[id]/page.tsx` → `updateTenantAction`.
- `/api/cep/[cep]` (route handler próprio do front) mantido — não é parte da migração do backend Express.
- Ficam no Express (outros módulos): dropdowns de owners/tenants em `imoveis`/`locacoes` (migram nesses módulos); listagem via `DataTable`/`DynamicFormManager`.

### Validação
- `npx tsc --noEmit` → **0 erros** · `npx vitest run` → **85/85 passando**.
- ⏳ End-to-end pendente (requer `next dev` + Postgres).

### Próximo
- **Módulo 7 — Property-types · Properties** (o maior; envolve uploads grandes, AVIF em background, SSE).

---

## Módulo 7 — Property-types · Properties  ·  2026-07-17  ·  ✅ concluído (aguardando validação)

> ⚠️ **Decisão de arquitetura para uploads (aprovada):** o backend usa `busboy` manipulando `req`/`res` do Express diretamente — responde ANTES do upload de arquivos terminar (evita timeout de proxy em vídeos grandes) e processa AVIF em background depois da resposta HTTP. Isso é estruturalmente incompatível com Server Actions (que só retornam quando terminam, sem "responder cedo e continuar depois"). **Decisão: Server Action síncrona simples** — a action recebe o FormData, salva os arquivos e só retorna quando tudo (incluindo AVIF) terminar. Mais simples e correto no modelo SSR; o cliente espera o upload completo antes de ver a confirmação. Sem risco de timeout de proxy desde que Next/nginx não tenham timeout curto configurado (mesmo cuidado do backend original com `server.timeout=0`).

### Property-types — ✅ concluído
Migração de `/property-types/*` em SSR.

**Server Actions** (`src/server/actions/property-type.ts`): create/update/delete/restore + leituras (list, getById, getFilters).
**Queries** (`src/server/queries/property-type.ts`).

**Adicionado (Clean Architecture)**:
- `core/entities/property-type.ts`, `core/repositories/property-types-repository.ts`.
- `core/use-cases/property-type/crud.ts` — inclui a regra de **cascata do delete**: soft-delete de PropertyType também soft-deleta Properties e Leases com esse `type_id` (fiel ao backend).
- `infra/repositories/prisma-property-types-repository.ts`, `infra/factories/property-type-factory.ts`.
- `shared/validators/property-type.ts` (description obrigatória, ≤100 chars).

**Front refatorado**: `tipo-imovel/cadastrar` e `tipo-imovel/editar/[id]` → Server Actions.

**Testes**: 9 novos (create/update/delete/restore/getById), total **94 passando**. `tsc --noEmit` → 0 erros.

### Properties — 🔄 em andamento

**Mapeamento completo do backend concluído** (leitura direta de `PropertyService.ts` 2073 linhas, `DocumentService.ts`, `PropertyValidator`, `types/property.ts`, `PropertyController.ts`, `routes/property.ts` e o front consumidor).

**Achados que definem o escopo:**
- O front **só usa** `POST /properties/create-unified`, `PUT /properties/update-unified/:id` e `GET /properties/:id` (confirmado em `PropertyCreateForm.tsx`, `PropertyEditForm.tsx`, `propertyTransform.ts`). As rotas de CRUD "normal" (`POST/PUT /properties` sem "-unified") e o endpoint separado `POST/PUT /:id/documents` (`DocumentService.uploadDocuments/updateDocuments`) **não são chamadas pelo front atual** — não fazem parte do escopo desta migração (permanecem documentadas, não portadas).
- No `PropertyService`, os métodos `createPropertyWithFiles`, `createUnifiedProperty` (o método do *service*, não do controller) e `updatePropertyWithFiles` são **código morto** — nunca chamados pelas rotas ativas (`routes/property.ts` usa o `createUnifiedProperty`/`updateUnifiedProperty` do *controller*, que chamam `createPropertyTransaction`/`updatePropertyTransaction` + `processUploadedTempFiles`). Não portados.
- `DocumentService.setFeaturedDocument` também é dead code (não referenciado por nenhuma rota) — a lógica de imagem destacada já está embutida em `PropertyService.processUploadedTempFiles`.

**Decisão de transporte do upload (aprovada):** o front usa `useUploadSSE` (XHR com barra de progresso de bytes enviados + suporte a 201 legado ou 202+SSE). Server Actions não são URLs HTTP chamáveis por XHR. **Decisão: trocar `useUploadSSE` por chamada direta à Server Action** nas telas de imóveis — perde a barra de progresso de bytes (XHR `upload.onprogress`), ganha SSR real sem Route Handler. Mostraremos um spinner/estado "enviando..." genérico no lugar.

**Status: ✅ concluído** (aguardando validação).

### Adicionado (Clean Architecture)
- **core/entities/property.ts** — `Property`, `CreateUnifiedPropertyData`, inputs de endereço/values/IPTU, `PropertyUploadFiles`.
- **core/repositories/properties-repository.ts** — contrato (list/filters/getById/exists-checks/create/update/delete/restore/createDocuments).
- **core/use-cases/property/** — `read.ts` (List/GetFilters/GetById), `create-unified.ts`, `update-unified.ts`, `crud.ts` (Delete/Restore).
- **core/storage/storage.ts** — interface `Storage` estendida com `uploadMedia()` (upload + conversão AVIF quando aplicável) e `UploadMediaResult`.
- **infra/storage/image-converter.ts** — porte de `ImageConverter` (sharp → AVIF), agora **síncrono** (ver decisão abaixo).
- **infra/storage/minio-storage.ts** — implementa `uploadMedia()`.
- **infra/repositories/prisma-properties-repository.ts** — porte completo do `PropertyService` (escopo unificado): list com busca em memória (direto + owner + type + agency + endereço), ordenação direta/relacional pt-BR, filtro de `status` aplicado em memória sobre `values[0]` (fiel ao backend — não vai para o WHERE), `create`/`update` em `$transaction` (endereço + PropertyValue + PropertyIptu, upsert por id nos IPTUs), ordenação de documentos (destacado → vídeo → mais recente), filtros contextuais.
- **infra/factories/property-factory.ts** — composition root.
- **shared/validators/property.ts** — Zod fiel ao `PropertyValidator` (obrigatórios, IPTU condicional por `payment_condition`).
- **shared/http/form-data.ts** — helpers de extração de campos/arquivos de `FormData` em Server Actions (substitui o parsing do busboy/multer).

### Server Actions e Queries
- `src/server/actions/property.ts` — `createUnifiedPropertyAction`, `updateUnifiedPropertyAction`, `deletePropertyAction`, `restorePropertyAction` + leituras.
- `src/server/queries/property.ts` — `listPropertiesData`, `getPropertyByIdData`, `getPropertyFiltersData`.

### Decisões de arquitetura aplicadas (ambas aprovadas)
1. **Upload síncrono:** a Server Action só retorna quando imóvel + endereço + values + IPTUs + upload de todos os arquivos + conversão AVIF estiverem concluídos — substitui o padrão do backend (busboy respondendo antes do upload terminar + processamento em background via `setImmediate`), que não é replicável em Server Actions.
2. **Transporte do upload trocado:** `useUploadSSE` (XHR com barra de progresso de bytes + suporte a SSE) foi **substituído por chamada direta à Server Action** nas telas de imóveis — Server Actions não são URLs HTTP chamáveis por XHR. Perdeu-se a barra de progresso de bytes enviados; ganho um spinner genérico "enviando...". `useUploadSSE`/`UploadProgressOverlay` continuam existindo (usados por Branding `AssetUploader`, fora do escopo deste módulo).

### Comportamento preservado (14 testes novos)
- Validação de referências (owner/type/agency inexistentes → 404) antes de criar/atualizar.
- IPTUs: upsert por `id` presente/ausente; os que saíram da lista enviada são removidos (`deleteMany` com `notIn`).
- Imagem destacada (`featuredImageIdentifier`): casa por nome de arquivo OU nome sem extensão, desmarca as demais `IMAGE` do imóvel.
- `removedDocuments` no update: soft-delete antes da transação principal (igual ao backend).

### Front refatorado para SSR
- `PropertyCreateForm.tsx` → `createUnifiedPropertyAction` (era `useUploadSSE` + XHR).
- `PropertyEditForm.tsx` → `updateUnifiedPropertyAction`.
- `_lib/propertyTransform.ts` → `fetchProperty` usa `getPropertyByIdData()`; `fetchPropertySelectOptions` usa as queries de Owners/Property-types/Agencies já migradas (financeiro segue HTTP até o Módulo 9).

### Fora do escopo desta migração (não portado — não usado pelo front atual)
- `POST/PUT /properties` (CRUD "normal", JSON puro sem upload) — só as rotas "-unified" são chamadas pelo front.
- `POST/PUT /properties/:id/documents` (`DocumentService.uploadDocuments/updateDocuments`) — endpoint separado, não referenciado pelo front.
- `PropertyService.createPropertyWithFiles`, `createUnifiedProperty` (o método do *service*), `updatePropertyWithFiles` — código morto no backend (nunca chamados pelas rotas ativas).
- `DocumentService.setFeaturedDocument` — dead code (a lógica de destaque já está embutida no fluxo unificado).
- Os 3 dropdowns de imóveis em `locacoes/*` continuam via `NEXT_PUBLIC_URL_API` — migram no Módulo 8 (Leases).

### Validação
- `npx tsc --noEmit` → **0 erros** · `npx vitest run` → **108/108 passando** (16 auth + 16 company + 13 user + 12 agency + 23 owner/tenant + 9 property-type + 14 property + 5 br-documents).
- ⏳ **End-to-end especialmente recomendado aqui** (requer `next dev` + Postgres + MinIO): é o módulo com upload real de arquivo + conversão AVIF, nunca exercitado.

### Próximo
- **Módulo 8 — Leases** (locações), que também usa upload de documentos (`arquivosLocacao`) — reaproveita o padrão de Server Action síncrona já validado aqui.

---

## Módulo 8 — Leases (Locações)  ·  2026-08-08  ·  ✅ concluído (aguardando validação)

Migração de `/leases/*` (CRUD, cancelamento, prévia de cancelamento, upload de documentos) e da sincronização de lançamentos financeiros da locação, portada fielmente de `LeaseService.ts` (~977 linhas) e `LeaseFinanceService.ts` (~327 linhas).

### Adicionado (Clean Architecture)
- **core/entities/lease.ts** — `Lease`, `CreateLeaseData`/`UpdateLeaseData`, `CancelLeaseInput`/`CancellationChargeInput`/`CancellationPreview`/`CancelLeaseResult`, `SyncLeaseTransactionsResult`, `IptuInstallmentInput`, `Guarantor`.
- **core/repositories/leases-repository.ts** — contrato completo: list/getFilters/findById/contractNumberExists(Except)/getPropertyCategoryId/create/update/softDelete/permanentlyDelete/restore/getCancellationPreview/cancel/exists/removeDocuments/createDocuments.
- **core/repositories/lease-finance-repository.ts** — `syncLeaseTransactions(leaseId, companyId)`.
- **core/use-cases/lease/crud.ts** — List/GetFilters/GetById/Create (exige categoria no imóvel, `contract_number` único → 409, sincroniza financeiro após o commit com fallback `finance_warning` se a sincronização falhar)/Update (mesmo padrão)/Delete/PermanentlyDelete/Restore.
- **core/use-cases/lease/cancellation.ts** — `GetCancellationPreviewUseCase`, `CancelLeaseUseCase` (recebe `companyId` da sessão, não do body).
- **core/use-cases/lease/documents.ts** — `UpdateLeaseDocumentsUseCase` (remove documentos marcados + sobe os novos via `Storage.upload`, tipo `LEASE_CONTRACT`, sem conversão AVIF — diferente de imagens de imóveis).
- **infra/repositories/prisma-leases-repository.ts** — porte completo: `list` com busca em memória (contract_number/id/status/payment_condition + imóvel/tipo/proprietário/inquilino), `determineStatus` (EXPIRED/EXPIRING≤1 mês/ACTIVE, nunca sobrescreve CANCELED), `create`/`update` ajustando `PropertyValue` (OCCUPIED/AVAILABLE), `cancel` (soft-delete das transações confirmadas, encargo opcional, libera o imóvel se não houver outra locação ativa), `getCancellationPreview`, `permanentlyDelete` (cascata de transações).
- **infra/repositories/prisma-lease-finance-repository.ts** — porte fiel de `syncLeaseTransactions`: geração de aluguel mensal (a partir do mês seguinte ao início), comissão, IPTU pelas 3 condições de pagamento (à vista com 15% de desconto, 2ª parcela com 10%, parcelado livre — com fallbacks de 0,85/0,45 quando os valores não foram informados), `dueDate` ajustada para o último dia do mês quando necessário, fornecedor-espelho da imobiliária (`internal_code: AG-${agencyId.slice(0,8)}`), **idempotência**: chave = primeira palavra da descrição + número da parcela — `PENDING` é regenerado, `COMPLETED` é preservado.
- **infra/factories/lease-factory.ts** — composition root, incluindo `updateDocuments` com `minioStorage`.
- **shared/validators/lease.ts** — `createLeaseSchema`/`updateLeaseSchema` (Zod, `passthrough`), `listLeasesQuerySchema`, `validateLeaseBusinessRules(data, isUpdate)`: retorna `warnings[]` não-bloqueantes ou lança `ValidationError` para os bloqueantes (datas inconsistentes, `payment_condition` inválida, `rent_due_day` ausente no create). Inclui `validateIptuConditions` fiel ao `LeaseValidator` original, com mensagens formatadas em BRL e tolerância de ±R$0,10 nas faixas de desconto (15%/10%) e na soma das parcelas livres.

### Server Actions e Queries
- `src/server/actions/lease.ts` — `createLeaseAction`/`updateLeaseAction` (anexam `warnings` = regras de negócio + `finance_warning`, mesmo contrato do backend que anexava `warnings` à resposta de sucesso), `deleteLeaseAction`, `permanentlyDeleteLeaseAction`, `restoreLeaseAction`, `cancelLeaseAction` (company_id vem da sessão via `withTenant`), `updateLeaseDocumentsAction` (lê `FormData`, extrai arquivos de `arquivosLocacao` + `removedDocuments` + `userId`, upload síncrono) + leituras (list/getById/getFilters/getCancellationPreview) para uso em Client Components.
- `src/server/queries/lease.ts` — `listLeasesData`, `getLeaseByIdData`, `getLeaseFiltersData`, `getCancellationPreviewData`, com `splitListParams` normalizando aliases de ordenação (`property_title` → `property.title`, `type_description` → `property.type.description`, `owner_name` → `owner.name`, `tenant_name` → `tenant.name`), fiel ao `LeaseController.getLeases`.

### Front refatorado para SSR
- `locacoes/cadastrar/page.tsx` — imóveis/inquilinos/imobiliárias via Server Actions (Módulos 5-7); criação via `createLeaseAction`; upload de mídias pós-criação via `updateLeaseDocumentsAction` (substitui `useUploadSSE`); instituição financeira segue via HTTP até o Módulo 9.
- `locacoes/editar/[id]/page.tsx` — mesmo padrão para update; carrega o registro via nova prop `fetchResource` do `DynamicFormManager` (ver abaixo) em vez do fetch HTTP interno.
- `locacoes/visualizar/[id]/page.tsx` — leitura via `fetchResource`; exclusão definitiva via `permanentlyDeleteLeaseAction`.
- `components/domain/leases/LeaseCancellationModal/index.tsx` — prévia via `getCancellationPreviewAction`, efetivação via `cancelLeaseAction` (as chamadas HTTP de opções do encargo — categoria/subcategoria/instituição/centro/fornecedor — seguem via `authFetch` até o Módulo 9).
- `components/table/DataTable/index.tsx` — ações em massa de cancelar (via `updateLeaseAction`) e excluir definitivamente (via `permanentlyDeleteLeaseAction`) locações trocadas de `fetch` cru para Server Action.

### Extensão de infraestrutura compartilhada
- `components/form/DynamicForm/index.tsx` (`DynamicFormManager`) ganhou a prop opcional `fetchResource?: (id: string) => Promise<any>`: quando informada, o componente usa esse carregador (uma Server Action) em vez do fetch interno `${NEXT_PUBLIC_URL_API}/${resource}/${id}` no modo edit/view. **Retrocompatível** — módulos que ainda não migraram continuam com o fetch HTTP padrão (prop omitida). Reaproveitável por qualquer módulo futuro que precise trocar a leitura do registro por Server Action sem reescrever o componente inteiro.

### Achado durante a migração (fora do escopo original do Módulo 6, corrigido aqui)
- **`GET /tenants/next-internal-code`** (`TenantController.getNextInternalCode`) existia no Express e não constava do mapeamento original de Tenants (Módulo 6) — só foi percebido ao portar a tela de cadastro de locação, que depende da tela de cadastro de inquilino estar coerente. Portado agora: `core/use-cases/tenant/crud.ts` ganhou `GetNextTenantInternalCodeUseCase`; `infra/repositories/prisma-tenants-repository.ts` ganhou `getNextInternalCode()` (MAX numérico de `internal_code` da empresa + 1, ignora códigos não numéricos); exposto via `getNextTenantInternalCodeAction`. Isso corrigiu de brinde um bug do front: a tela antiga usava `sort[internal_code]=desc` (ordenação lexicográfica de string — "9" > "12" — sugeria códigos já usados).

### Comportamento preservado
- `agency_commission`: enviado pela tela de locação, mas não existe no schema Prisma nem no `LeaseService` original — o backend ignora silenciosamente; comportamento replicado (campo aceito e descartado).
- Cancelamento nunca cria encargo automaticamente — é sempre opcional, escolhido pelo usuário no modal.
- `finance_warning` nunca bloqueia a criação/atualização da locação — a locação é sempre persistida primeiro, a sincronização financeira roda depois e falhas viram aviso.

### Comportamento NÃO portado (não usado pelo front atual)
- `TransferService.ts` (mencionado no controller mas não referenciado por nenhuma rota ativa de Leases chamada pelo front) — não investigado neste módulo; revisar se aparecer necessidade real no Módulo 9.

### Validação
- `npx tsc --noEmit` → **0 erros** · `npx vitest run` → **128/128 passando** (108 anteriores + 20 novos em `core/use-cases/lease/__tests__/lease-use-cases.test.ts`: CreateLease sucesso/imóvel sem categoria (400)/contract_number duplicado (409)/falha de sync financeiro vira aviso sem invalidar a locação, UpdateLease 404/409/sucesso com re-sync, Delete/PermanentlyDelete/Restore, GetById, GetCancellationPreview, CancelLease, e `validateLeaseBusinessRules` nas 3 condições de pagamento de IPTU).
- ⏳ **End-to-end ainda não realizado** (requer `next dev` + Postgres + MinIO) — é o módulo com a regra de negócio mais crítica até aqui (geração idempotente de lançamentos financeiros, cancelamento com estorno). Recomenda-se validar manualmente antes de avançar para mais módulos sem checkpoint.

### Próximo
- **Módulo 9 — Financeiro**, o maior módulo restante (`TransactionService.ts` ~1314 linhas). Ordem sugerida: `financial-institution` → `category` → `subcategory` → `card` → `center` → `supplier` → `transaction` → `invoice`. `prisma-lease-finance-repository.ts` já modela parte de Transaction/Supplier — revisar antes de recriar essas entidades do zero.

---

## Modulo 9 - Financeiro: transaction (Lancamentos)  -  2026-08-08  -  @. concluido (aguardando validacao)

Migracao do CRUD de lancamentos financeiros de ``TransactionService.ts`` (~1314 linhas) + ``TransferService.ts`` + ``RecurringService.ts`` + ``src/utils/seriesPropagation.ts``.

### Adicionado (Clean Architecture)
- **core/entities/financial-transaction.ts** - ``Transaction``, ``CreateTransactionData``/``UpdateTransactionData`` (com ``propagate_to_following``/``propagate_fields``), ``ListTransactionsParams``/``PaginatedTransactions`` (``summary`` + ``totals`` para o painel lateral), ``TransactionFiltersResult``, ``CreateTransferData``/``TransferResult``, ``CreateInstallmentsData``/``InstallmentsResult``, ``CreateRecurrenceData``/``RecurrenceResult``, ``RelatedTransactionsResult``.
- **shared/utils/series-propagation.ts** - porte fiel de ``api-nairim-v2/src/utils/seriesPropagation.ts`` (``PROPAGATABLE_FIELDS``, ``sanitizePropagateFields``, ``parseSeriesDescription``, ``buildPropagatedDescription``).
- **core/repositories/financial-transactions-repository.ts** - contrato com list/getFilters/findById/create/update (cascata do par de transferencia + `` `` ``logateToFollowing``)/delete/restore/createTransfer/createInstallments/createRecurrence/getRelated.
- **core/use-cases/financial-transaction/crud.ts** - List/GetFilters/GetById/Create (valida com o mesmo conjunto de mensagens do backend)/Update/Delete/Restore/CreateTransfer (origem != destino)/CreateInstallments (2..120 parcelas, total balanceado)/CreateRecurrence (7 frequencias, primeira data posterior ao inicio)/GetRelated.
- **infra/repositories/prisma-financial-transactions-repository.ts** - porte fiel: ``list`` com busca em memoria + sort por relacao e ``groupBy`` status/sumary/totals (``NOT is_transfer``), ``getFilters``, ``findOrCreateInvoice`` no create de ``Card``-based, ``update`` com propagacao de serie (parcelas/ocorrencias seguintes + RecurringConfig), soft-delete com cascata do par de transferencia, ``createTransfer`` (categorias internas ``Transferencia entre Contas � Saida/Entrada`` find-or-create), ``createInstallments`` (``installment_group_id`` no grupo, datas efetivas mes a mes), ``createRecurrence`` (RecurringConfig + gera ~5 anos, ``createMany`` idempotente), ``getRelated``.
- **infra/factories/financial-transaction-factory.ts** - composition root com todos os use-cases acima.

### Server Actions e Queries
- ``src/server/actions/financial-transaction.ts`` - create/update/delete/restore + transfer/installments/recurrence + leituras (list/getById/getFilters/getRelated) para Client Components.
- ``src/server/queries/financial-transaction.ts`` - ``listFinancialTransactionsData`` (com ``splitListParams`` normalizando ``sort[field]``/``filter[field]`` e arrays/JSON), ``getTransactionByIdData``, ``getTransactionFiltersData``, ``getRelatedTransactionsData``.

### Front integrado (SSR / Server Actions)
- ``lancamentos/page.tsx`` - removido ``fetch(API_URL/financial-transaction/*)`` e das quick-creates de categoria/subcategoria/instituicao/cartao/centro/fornecedor; tudo via Server Actions.
- ``InlineEditableTable``/``useOptimizedTableData``/``useDynamicFilters`` - props opcionais ``dataFetcher``/``filtersFetcher``/``bulkCreateHandler`` (retrocompativeis, padrao continua o fetch HTTP para os demais recursos); a grid de lancamentos agora busca por ``listFinancialTransactionsAction``/``getTransactionFiltersAction``, e o modal de Parcelado/Recorrente via ``createInstallmentsAction``/``createRecurrenceAction``/``createFinancialTransactionAction``.

### Mudanca de schema
- ``prisma/schema.prisma`` - enum ``RecurringFrequency`` ganhou ``BIWEEKLY``/``BIMONTHLY``/``SEMIANNUAL`` (o backend ja usava 7 valores; o schema front so tinha 4). Rodar ``npx prisma generate`` (feito).

### Validacao
- ``npx tsc --noEmit`` ae' **0 erros** - ``npx vitest run`` ae' **295/295 passando** (257 anteriores + 38 novos em ``core/use-cases/financial-transaction/__tests__/financial-transaction-use-cases.test.ts``).

### Ainda no Express (proximo dentro do Modulo 9)
- ``/financial-transaction/monthly-summary``, ``/available-years``, ``/expense-by-category``, ``/subcategory-breakdown`` (dashboard/relatorios) e ``/recurring/generate-next``, ``DELETE /group/:group_id``, documentos/attachments (``TransactionAttachmentsModal``). ``/financial-invoice`` (proximo modulo).

### Proximo
- **Modulo 9h - Invoice** (``InvoiceService.ts`` ~390) e depois os endpoints de summary/breakdown restantes.

## Módulo 9g.2 — transaction: relatórios + anexos (summary/breakdown/documents)  ·  2026-08-08

Migração dos endpoints de agregação de `TransactionService.ts` usados pelos gráficos do Financeiro/Dashboard e dos anexos de lançamento (`DocumentService` / `TransactionAttachmentsModal`), fechando o Módulo 9g.

### Adicionado (Clean Architecture)
- **core/entities/financial-transaction.ts** — `MonthSummary`, `MonthlySummary`, `MonthlySummaryMultiResult`, `AvailableYearsResult`, `ByYearValue`, `ExpenseByCategoryItem`/`ExpenseByCategoryResult`, `SubcategoryBreakdownItem`/`SubcategoryBreakdownResult`, `TransactionEntityFilters`, `TransactionDocument`, `TransactionAttachmentFile`.
- **core/repositories/financial-transactions-repository.ts** — contrato ganhou `getMonthlySummary`, `getMonthlySummaryMulti`, `getAvailableYears`, `getExpenseByCategory`, `getSubcategoryBreakdown`, `listDocuments`, `countDocuments`, `createDocuments`, `removeDocuments`.
- **core/use-cases/financial-transaction/reports.ts** — `GetMonthlySummaryUseCase`, `GetMonthlySummaryMultiUseCase`, `GetAvailableYearsUseCase`, `GetExpenseByCategoryUseCase`, `GetSubcategoryBreakdownUseCase` (com `parseFilters` replicando `parseEntityFilters` do controller Express para o botão Filtro/Tarefa 5.1).
- **core/use-cases/financial-transaction/attachments.ts** — `ListTransactionDocumentsUseCase`, `UploadTransactionDocumentsUseCase` (valida existência do lançamento, mime PDF/JPEG/PNG e o limite de 5 anexos; upload síncrono via `Storage`), `RemoveTransactionDocumentUseCase` (soft-delete + delete do arquivo no storage).
- **infra/repositories/prisma-financial-transactions-repository.ts** — porte fiel das agregações (`groupBy`/`aggregate` com `NOT is_transfer`, detalhamento `byYear` quando o período cobre >1 ano, etc.) e dos métodos de `Document`.
- **infra/factories/financial-transaction-factory.ts** — wiring dos novos use-cases (com `minioStorage`).

### Server Actions e Queries
- **src/server/queries/financial-reports.ts** — `getMonthlySummaryData`, `getMonthlySummaryMultiData`, `getAvailableYearsData`, `getExpenseByCategoryData`, `getSubcategoryBreakdownData`, `getTransactionDocumentsData`.
- **src/server/actions/financial-transaction.ts** — `getMonthlySummaryAction`, `getMonthlySummaryMultiAction`, `getAvailableYearsAction`, `getExpenseByCategoryAction`, `getSubcategoryBreakdownAction`, `getTransactionDocumentsAction`, `uploadTransactionDocumentsAction` (multipart, campo `attachments`), `deleteTransactionDocumentAction`.
- **src/shared/validators/financial-reports.ts** — `monthlySummaryQuerySchema`, `monthlySummaryMultiQuerySchema`, `expenseByCategoryQuerySchema`, `subcategoryBreakdownQuerySchema`, `parseMultiYears`.

### Front refatorado para SSR
- **hooks/useMonthlySummary.ts** — `useMonthlySummary` agora chama `getMonthlySummaryAction` (removido `authFetch`).
- **hooks/useMonthlySummaryMulti.ts** — `useMonthlySummaryMulti` virou UMA chamada a `getMonthlySummaryMultiAction` (antes era N fetches a `/monthly-summary`).
- **hooks/useAvailableYears.ts** — `getAvailableYearsAction`.
- **components/dashboard/ExpenseByCategoryChart** — `getExpenseByCategoryAction`.
- **components/dashboard/SubcategoryBreakdownChart** — categorias via `listCategoriesAction` (Módulo 9a) e breakdown via `getSubcategoryBreakdownAction`.
- **components/domain/financial/TransactionAttachmentsModal** — list/upload/delete via Server Actions (FormData), mantendo limite de 5 e validação de mime.

### Mudança de schema
- **prisma/schema.prisma** — `Document` ganhou `transaction_id` (+ relação `Transaction.documents` e índice) para o `TransactionAttachmentsModal`. Rodar `npx prisma generate` (feito).

### Não portado (código morto / sem consumidor no front atual)
- `POST /financial-transaction/recurring/generate-next` (`generateNextRecurring`) e `DELETE /financial-transaction/group/:group_id` (`deleteTransactionGroup`) — nenhum componente ou hook do front os chama (grep não encontrou consumidores). Se aparecer uso, portar no Módulo 11 (Dashboard) ou quando o fluxo existir.

### Validação
- `npx tsc --noEmit` = **0 erros** · `npx vitest run` = **317/317 passando**.

---

## Módulo 10 — Planning + IPTU + Favorites  ·  2026-08-09  ·  ✅ concluído (aguardando validação)

Migração do dashboard de Planejamento (`/planning/dashboard`), do upsert/delete de planejamento (`/planning`) e dos filtros de IPTU do imóvel (`/iptu-property/filters`).

### Adicionado (Clean Architecture)
- **core/entities/planning.ts** — `PlanningType`, `Planning`, `UpsertPlanningData` (FIXED/VARIABLE, 12 `PlanningMonth`), `PlanningDashboardFilters`, `MonthlyData`, `MonthlyPlanned`, `PlanningDashboardItem` (`min`/`med`/`max` + `min_recommended`/`max_recommended`), `PlanningCategoryDashboard`, `PlanningDashboardResponse` (saldos mensais/acumulados, `incomes`/`expenses`).
- **core/entities/iptu-property.ts** — `PaymentCondition`, `IptuPropertyFilter`, `IptuPropertyOperators`, `IptuPropertyFiltersResult` (filtros dinâmicos do DynamicFilterModal).
- **core/repositories/plannings-repository.ts** — `PlanningsRepository` (`upsert` com `company_id?` opcional injetado pela extensão, `remove`, `getDashboard`).
- **core/repositories/iptu-properties-repository.ts** — `IptuPropertiesRepository.getFilters`.
- **core/use-cases/planning/crud.ts** — `UpsertPlanningUseCase` (category_id obrigatório; FIXED exige default_amount não-negativo; VARIABLE exige monthly_values 1..12 sem duplicados e não-negativos; normaliza `''`→null), `GetPlanningDashboardUseCase` (startDate/endDate YYYY-MM-DD, start<=end), `DeletePlanningUseCase`.
- **core/use-cases/iptu-property/get-filters.ts** — `GetIptuPropertyFiltersUseCase`.
- **infra/repositories/prisma-plannings-repository.ts** — porte fiel: upsert grava os 12 `PlanningMonth` para VARIABLE (FIXED não tem meses), soft-delete, `getDashboard` (meses do período sem timezone, categorias ativas + subcategorias ativas, mapa `category::sub` de planejamentos globais, agregação de `Transaction COMPLETED` com `status` inerente + filtros do botão Filtro, saldo anterior, itens com `min/med/max` do realizado, totais globais "Total de Receitas"/"Total de Despesas").
- **infra/repositories/prisma-iptu-properties-repository.ts** — porte de `getIptuPropertyFilters` (aplica filtros year/payment_condition/valores/nº parcelas e devolve `{filters, operators, defaultSort, searchFields}`).
- **infra/factories/planning-factory.ts** — composition root dos dois módulos.

### Server Actions e Queries
- **src/server/actions/planning.ts** — `upsertPlanningAction`, `deletePlanningAction`, `getPlanningDashboardAction`.
- **src/server/queries/planning.ts** — `getPlanningDashboardData` (parse das datas + filtros flat `field`/`field[]`).
- **src/server/actions/iptu-property.ts** + **src/server/queries/iptu-property.ts** — `getIptuPropertyFiltersAction`/`getIptuPropertyFiltersData`.
- **src/shared/validators/planning.ts** — `planningUpsertSchema`, `planningDashboardQuerySchema`.

### Front refatorado para SSR
- **planejamento/content.tsx** — GET `/planning/dashboard` → `getPlanningDashboardAction`; POST `/planning` → `upsertPlanningAction`; modal de detalhe Realizado → `listFinancialTransactionsAction` (removidos `authFetch` e `NEXT_PUBLIC_URL_API`).
- **components/planejamento/PlanningEditModal** — POST/PUT → `upsertPlanningAction`; DELETE → `deletePlanningAction`.
- **components/dashboard/RealizedVsPlannedChart** e **PlanningSubcategoryBarChart** — dashboard via `getPlanningDashboardAction` (substitui `authFetch`).
- **components/table/DataTable** — prop opcional `filtersFetcher` (espelha o InlineEditableTable) passada ao `useDynamicFilters`.
- **components/domain/financial/IptuManager** — filtros de `/iptu-property/filters` via `getIptuPropertyFiltersAction` (prop `filtersFetcher`), mantendo o modo local `localData`.

### Não portado (código morto / sem consumidor no front atual)
- `/favorite*` (`FavoriteService.ts` ~437) — grep não encontrou nenhum consumidor no front (`/favorite`, `/favorite/check`, etc.). Portar quando houver uso.

### Validação
- `npx tsc --noEmit` = **0 erros** · `npx vitest run` = **331/331 passando** (317 anteriores + 14 novos em `core/use-cases/planning/__tests__/planning-use-cases.test.ts`).

---

## Módulo 11 — Dashboard  ·  2026-08-09  ·  ✅ concluído (aguardando validação)

Migração das métricas do dashboard (`/dashboard/financial`, `/portfolio`, `/clients`, `/map`, `/all` — o último não tem consumidor e foi documentado, não portado). As quatro leituras exigem `startDate`/`endDate` (obrigatórios, `YYYY-MM-DD`, `start <= end`, intervalo máx. 365 dias).

### Adicionado (Clean Architecture)
- **core/entities/dashboard.ts** — `DashboardSection`, `DashboardParams`, `MetricResult` (`result/variation/isPositive/data`), `ChartData`, `FinancialMetrics`, `PortfolioMetrics` (`totalPropertys`, `countPropertiesWithLessThan3Docs`, `totalPropertiesWithSaleValue?`, `availablePropertiesByType`, `vacancyRate`/`occupationRate`/`physicalVacancy`), `ClientsMetrics`, `GeolocationResponse.coordinates`, `PeriodComparison`. Porte de `types/dashboard.ts`.
- **core/repositories/dashboard-repository.ts** — `DashboardRepository` (`getFinancial/getPortfolio/getClients/getGeolocation`, todos `(startDate, endDate)`).
- **core/use-cases/dashboard/crud.ts** — `resolveDashboardPeriod` (validação 1:1 do `validateDashboardParams`), `GetFinancialMetricsUseCase`, `GetPortfolioMetricsUseCase`, `GetClientsMetricsUseCase`, `GetGeolocationUseCase`.
- **core/utils/dashboard-metrics.ts** — helpares puros portados do `DashboardService.ts`: `decimalToNumber`, `calcVariation` (variação limitada a ±100%, `result`/`variation` com 2 decimais), `getPeriodDatesIn` (período corrente/anterior), `calculateVacancyMonths` (sem leases → 12; `end >= ref` → 0; senão meses completos). Separados em core p/ testes sem Prisma.
- **infra/repositories/prisma-dashboard-repository.ts** — porte fiel: consultas `create_at` por período (corrente e anterior, `Promise.all`), includes (type/values/agency/owner/leases/documents/addresses), agrupamento por tipo/agência no `data`, `countPropertiesWithLessThan3Docs`/`isComplete` preservam o comportamento do backend (propriedade "completa" com **ao menos um** dos `TITLE_DEED|REGISTRATION|PROPERTY_RECORD`), `propertiesPerOwner` anterior estimado proporcional ao nº de proprietários, `getGeolocation` filtra endereços sem lat/lng.
- **infra/factories/dashboard-factory.ts** — composition root.

### Server Actions e Queries
- **src/shared/validators/dashboard.ts** — `dashboardParamsSchema` (zod, erros em PT idênticos ao backend: obrigatórios, formato, start<=end, "O intervalo máximo permitido é de 365 dias").
- **src/server/queries/dashboard.ts** — `getDashboardSectionData(section, raw)` (parse + `withTenant`, dispatch por seção).
- **src/server/actions/dashboard.ts** — `getDashboardSectionAction(section, startDate?, endDate?)` (ActionResult para Client Components).

### Front refatorado para SSR (sem `fetch`/token)
- **lib/dashboard.ts** — `fetchSection` agora chama `getDashboardSectionAction` (removeu `NEXT_PUBLIC_URL_API`, `ENDPOINT_MAP` e header `Authorization`); mantém `getDefaultDateRange`, `FilterType`, `DashboardData`, `MapCoordinate` e a normalização de coordenadas do mapa. Erros voltam com `.status` (403/400/etc.).
- **app/dashboard/page.tsx** — pré-carga SSR do seletor `financial` via `getDashboardSectionData` (query server, sem ler o cookie `authToken`); default de período = `getDefaultDateRange()`.
- **components/domain/dashboard/DashboardClient** — remoção do `useAuth`/token; seções lazy e troca de período via `fetchSection` (agora action).

### Não portado (código morto / sem consumidor no front atual)
- `GET /dashboard/all` (`DashboardController.getAll`) — o front só usa as 4 seções separadas (`financial`/`portfolio`/`clients`/`map`). Se aparecer consumo, agregar as 4 chamadas.

Nota de arquitetura: com isso, a interação do dashboard com o backend Express cessa para os dados já migrados — quem consome é a própria API da Next através de Server Actions (sem token visível ao cliente).

### Validação
- `npx tsc --noEmit` = **0 erros** · `npx vitest run` = **352/352 passando** (331 anteriores + 21 novos em `core/use-cases/dashboard/__tests__/dashboard-use-cases.test.ts`).

---

## Módulo 12 — Public + Backup · 2026-08-09 · ✅ concluído (aguardando validação)

Migração da vitrine pública `/public/:companySlug` (sem JWT; o tenant é resolvido pelo **slug** da URL, não pela sessão) e do Backup por empresa (`/backup` — gerar/restaurar arquivo JSON, requireAdmin).

### Adicionado (Clean Architecture) — Public
- **core/entities/public-property.ts** — `PublicListParams`, `PublicPaginated<T>` (`{ items, meta }`), `PublicProperty` (shape do `PUBLIC_PROPERTY_SELECT`: `type`/`agency` compactos, `addresses` → junction → `address`, `documents` só `IMAGE`, `values` o mais recente), `PublicOwner`, `PublicPropertyType`, `PublicAgency`, `PublicCompany`.
- **core/repositories/public-repository.ts** — `PublicRepository` (`getCompanyBySlug`, `getProperties(onlyAvailable?)`, `getPropertyById`, `getOwners`, `getPropertyTypes`, `getAgencies`).
- **core/use-cases/public/crud.ts** — `GetPublicCompanyBySlugUseCase`, `GetPublicPropertiesUseCase`, `GetAvailablePropertiesUseCase` (força `onlyAvailable`), `GetPublicPropertyByIdUseCase`, `GetPublicOwnersUseCase`, `GetPublicPropertyTypesUseCase`, `GetPublicAgenciesUseCase`.
- **core/utils/public-pagination.ts** — `paginatePublic` (clamp limit em [1,100]) e `publicMeta` (`totalPages` min 1), 1:1 do `PublicService.paginate`.
- **infra/repositories/prisma-public-repository.ts** — porte fiel: mesma `PUBLIC_PROPERTY_SELECT`, search OR (título/cidade/bairro, case-insensitive), `onlyAvailable → values.some({ status:'AVAILABLE', deleted_at:null })`, ordenação de properties `created_at desc` e de owner/type/agência por nome asc.
- **shared/validators/public.ts** — `parsePublicListParams` (defaults limit 12/page 1; `defaultLimit` 50 para owners/types/agencies), espelha `ValidationUtil` + `PublicController.listParams`.

### Adicionado (Clean Architecture) — Backup
- **core/entities/backup.ts** — `BACKUP_FORMAT_VERSION = 1`, `BackupMeta`, `BackupPayload`, `AutoBackupInfo`, `RestoreOutcome`.
- **core/utils/backup-filename.ts** — `buildChecksum` (SHA-256 de `JSON.stringify(data)`), `buildAutoBackupFilename`/`buildManualBackupFilename`/`autoBackupPrefix` (mesmos nomes do backend).
- **core/repositories/backup-repository.ts** — `BackupRepository` (`getCompanyById`, `exportCompany`, `restoreCompany`).
- **core/storage/backup-file-store.ts** — `BackupFileStore` (`writeAutoBackup`, `listAutoBackups`, `readAutoBackup`).
- **core/use-cases/backup/crud.ts** — `ExportBackupUseCase`, `RestoreBackupUseCase` (validação fiel: confirmação nome OU slug case-insensitive, estrutura `meta`+`data`, `formatVersion`, `company_id` do arquivo, mesmo checksum; auto-backup do estado atual ANTES de destruir; mensagem com contagem total de registros), `ListAutoBackupsUseCase`, `DownloadAutoBackupUseCase`.
- **infra/repositories/prisma-backup-repository.ts** — porte fiel do `exportCompany` (ordem de chaves `data` pais-antes-de-filhos + `meta` com `counts`) e da transação destrutiva `restoreCompany`: `$transaction` deletando filhos-antes-de-pais e reinserindo pais-antes-de-filhos; `address` e `user` via `upsert` (tabela compartilhada / usuários preservados); `Transaction` inserida sem pai e com `parent_transaction_id` religado em 2º passo.
- **infra/storage/node-backup-file-store.ts** — pasta `backup/` na raiz; validação anti-path traversal (`basename === filename`, prefixo da empresa, extensão `.json`) espelhando `resolveAutoBackupPath`.
- **infra/factories/backup-factory.ts** — composition root (repo + store + use-cases + `companyById`).

### Server Actions e Queries
- **src/server/queries/public.ts** — `getPublicPropertiesData` (opts `availableOnly`), `getPublicPropertyByIdData`, `getPublicOwnersData`, `getPublicPropertyTypesData`, `getPublicAgenciesData`. Todas resolvem a empresa ativa por slug (`findFirst { slug, is_active:true, deleted_at:null }`) e abrem `runWithTenant(company.id)` — equivale ao middleware `resolveCompanyBySlug` (404 `Empresa não encontrada`).
- **src/server/actions/public.ts** — `getPublicPropertiesAction(slug, raw, { availableOnly })`, `getPublicPropertyByIdAction(slug, id)`, `getPublicPropertyTypesAction(slug, raw)` (para Client Components).
- **src/server/actions/backup.ts** — `exportBackupAction` (retorna `{ payload, filename }`), `restoreBackupAction({ backupJson, confirmationName })` (parse JSON no servidor, erro `Arquivo de backup não é um JSON válido`), `listAutoBackupsAction`, `downloadAutoBackupAction(filename)` — todas `withTenant` com papel ADMIN (equivale a `requireAdmin`).
- **next.config.ts** — `serverActions.bodySizeLimit: '50mb'` (upload de restauração, mesmo limite do multer do POST `/backup/restore`).

### Front refatorado para SSR (sem `fetch`/`NEXT_PUBLIC_URL_API`)
- **src/services/property-service.ts** — `getAll`/`getAllProperties`/`getById` passam a chamar as Server Actions (envelope `{ items, meta }` preservado para os componentes). `getDocuments` e `getTypes` **removidos** (sem consumidor; `/documents` não existe no public).
- **src/app/page.tsx** (home) — `getImoveisDestaque` via `getPublicPropertiesData('nairim', { limit: 20 })`; `export const revalidate = 300` preserva o cache ISR anterior. `CarrosselDinamico`/`Header`/`Footer` inalterados.
- **src/components/filters/PropertyFilter** — tipos carregados via `getPublicPropertyTypesAction` (fallback: deriva dos imóveis com `getPublicPropertiesAction` limit 100, depois tipos fixos Casa/Apartamento).
- **src/app/dashboard/configuracoes/page.tsx** — Backup 100% Server Actions: export gera o arquivo localmente, restore lê o `.json` com `file.text()` e envia para a action, auto-backups listam/baixam via actions; removido `authFetch` e `NEXT_PUBLIC_URL_API`.

### Não portado (portado mas sem consumidor no front atual)
- `/public/:slug/owners` e `/public/:slug/agencies` — **queries/use-cases existem**, mas nenhum componente do front chega a carregá-las hoje (a vitrine usa apenas properties + property-types). Portados e testados por fidelidade; um futuro filtro por proprietário/imobiliária poderá usá-los.

### Validação
- `npx tsc --noEmit` = **0 erros** · `npx vitest run` = **391/391 passando** (352 anteriores + 16 de public-use-cases + 17 de backup-use-cases + 6 de node-backup-file-store).
