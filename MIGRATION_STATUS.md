# MIGRATION_STATUS.md — Painel de progresso da migração

> **Fonte única de verdade do progresso.** Se você é um agente retomando este trabalho numa nova conversa, **leia este arquivo primeiro**, depois `MIGRATION_MAP.md` (o mapa completo do backend + arquitetura-alvo) e `CHANGELOG_MIGRATION.md` (o detalhe do que já foi feito por módulo).
>
> Última atualização: **2026-08-13** · Estado atual: **os 8 módulos que ainda batiam no Express foram conectados às Server Actions — dependência real do Express caiu de 33 arquivos para ~0** (ver §4.5 e §1) — **e validado de ponta a ponta contra Postgres/MinIO reais** (ver §4.6, nova).
>
> ⚠️ **Histórico deste arquivo:** até 2026-08-09 este documento (e `MIGRATION_MAP.md`) declarava "12 de 12 módulos migrados, resta só desligar o Express" — essa afirmação estava **incorreta**. Uma auditoria de código (não de documentação) em 2026-08-12 revelou que **5 grupos de rota inteiros do backend nunca haviam sido inventariados** por nenhum dos dois documentos (não "não migrados" — **nunca contados**): `/audit-logs`, `/permissions`, `/financial-audit`, `/financial-reports`, `/user-groups`. Todos montados em `api-nairim-v2/src/routes/index.ts`, com controllers reais, e mais recentes que o mapeamento original de `MIGRATION_MAP.md` (por isso ausentes). Os 5 + `/permissions/me` foram portados como **Módulo 13** (ver §1 e §2 abaixo). A mesma auditoria de 2026-08-12 também quantificou, em §4.5, os 8 módulos que ainda usavam `fetch`/`authFetch` cru em create/edit apesar de listagem já migrada — **em 2026-08-13 esse trabalho foi concluído** (por outra sessão/agente; verificado e corrigido nesta revisão, ver nota abaixo). **Lição para quem reler este arquivo no futuro:** "N de N módulos" aqui é sobre os módulos *conhecidos* neste documento, não uma garantia de que o backend inteiro foi inventariado — reconferir sempre com `grep -rn "NEXT_PUBLIC_URL_API\|authFetch(" src` em vez de confiar na tabela.
>
> ⚠️ **Nota de verificação (2026-08-13):** o trabalho de conectar os 8 módulos (ver §4.5) foi feito por uma sessão/agente diferente da que escreveu a §4.5 original. Ao retomar, essa sessão havia deixado **7 erros de `tsc --noEmit`** em 3 arquivos (tipos `Paginated*` não exportados, union type de filtro frouxo demais, `operators` com chaves obrigatórias que a API real nem sempre envia) — todos corrigidos e verificados contra o backend Express original antes de aceitar a correção (não foram apenas "silenciados"). Também foram limpos ~29 problemas de lint introduzidos (majoritariamente `any` evitáveis com o tipo já existente na entidade `core/`). Um bug real pré-existente (não introduzido nesta rodada) foi encontrado e **não corrigido** — ver §3, `DataTable/index.tsx`: hook chamado condicionalmente. Dois achados novos fora do escopo de migração: `check-db.tmp.ts` e um `.code-workspace` perdido dentro de `InlineEditableTable/` são lixo de sessão sem `.gitignore`; e a rota `/api/lead` encaminha para `/leads` no Express, endpoint que **não existe** no backend atual (grep zero resultados) — feature do formulário de contato da vitrine provavelmente quebrada há tempo, independente do Express estar ligado ou não.
>
> 🔴 **Validação E2E (2026-08-13, mesmo dia, banco/MinIO reais disponíveis):** rodado `npx next dev` contra o Postgres e MinIO de produção/homolog com login real. Achado **crítico e sistêmico** durante o teste: `limit` acima de 100 em ~13 telas quebrava com 500 (Zod `.max(100)` sempre imposto no port, diferente do Express onde era inconsistente) — corrigido em todos os arquivos. Achado **crítico e mais sério**: objetos `Decimal` do Prisma (Property/Lease/Agency/Transaction) vazando cru para Client Components, quebrando o boundary RSC do React (`"Only plain objects can be passed to Client Components... Decimal objects are not supported"`) — corrigido nos 4 repositórios mais usados, mas **não é uma varredura exaustiva** (`prisma-financial-transactions-repository.ts` tem 1400+ linhas com o padrão espalhado; só os pontos de maior tráfego foram cobertos). Detalhe completo em §4.6.

---

## 0. Contexto rápido (para não se perder)

- **Objetivo:** migrar 100% da lógica do backend `C:\Users\Marcio\Desktop\api-nairim-v2` (Node/Express + Prisma) para dentro do Next.js `C:\Users\Marcio\Desktop\front-nairim-v2`, e no fim desativar o Express.
- **Nunca ler de outro repositório** além desses dois.
- **Arquitetura de apresentação (DECIDIDA):** **SSR nativo** — **Server Actions** (`src/server/actions/*`) para mutação + **Server Components / queries** (`src/server/queries/*`) para leitura. **NÃO** usar Route Handlers `/api`. Cookie de sessão gravado no servidor via `next/headers` (`src/infra/auth/session.ts`).
- **Clean Architecture (DECIDIDA):** full — `core/` (entities, use-cases, repositories interfaces, errors, cryptography, storage) → `infra/` (prisma, repos concretos, auth, storage, factories) → `server/` (actions/queries) → telas.
- **Deploy alvo (DECIDIDO):** Node/Docker self-hosted (uploads grandes, AVIF background, backup migram 1:1).
- **Coexistência:** o JWT do Next usa o **mesmo `JWT_SECRET` e payload** do Express → tokens valem nos dois. Cada módulo migra sua lógica + repointa as telas dele; o resto continua batendo no Express via `NEXT_PUBLIC_URL_API` até ser migrado.
- **Cookie `authToken`:** mantido **não-httpOnly** durante a coexistência (o `authFetch` client-side ainda lê pra chamar o Express). Endurecer p/ httpOnly só quando tudo for SSR.
- **Multi-tenant:** `AsyncLocalStorage` (`src/infra/database/tenant-context.ts`); handlers de tenant rodam dentro de `withTenant()` e o Prisma estendido injeta `company_id`. Exige runtime Node.
- **Validação:** Zod em `src/shared/validators/*`. **bcrypt → bcryptjs** (mesmo hash).

### Comandos úteis
```bash
cd C:/Users/Marcio/Desktop/front-nairim-v2
npx tsc --noEmit     # deve dar 0 erros
npx vitest run       # testes dos use-cases
npx prisma generate  # se mexer no schema
```

---

## 1. Progresso geral

**Estágios concluídos: 13 de 13 módulos conhecidos** (restam validação end-to-end e a desativação do Express). Ver aviso no topo do arquivo: "13 de 13" é sobre os módulos catalogados neste documento — não uma garantia de que nada mais falta no backend.

| # | Módulo / etapa | Status | Testes |
|---|---|---|---|
| 1 | **Fundação** (core/infra/shared base, Prisma multi-tenant, sessão SSR) | ✅ concluído | — |
| 2 | **Auth** (`/auth/*`) | ✅ concluído | 16 |
| 3 | **Company / Companies / Branding** (`/company/*`, `/companies/*`) | ✅ concluído | 16 |
| 4 | **Users / User-preferences** (`/users/*`, `/user-preferences/*`) | ✅ concluído | 13 |
| 5 | **Agencies** (`/agencies`) | ✅ concluído | 12 |
| 6 | **Owners** (`/owners`) · **Tenants** (`/tenants`) | ✅ concluído | 28 |
| 7 | **Property-types** (`/property-types`) · **Properties** (`/properties`) ⚠️ maior + uploads | ✅ concluído | 23 |
| 8 | **Leases** (`/leases`) + cancelamento + finança de locação | ✅ concluído | 20 |
| 9 | **Financeiro** (institution→category→subcategory→card→center→supplier→transaction→invoice) | ✅ concluído | 138 |
| 10 | **Planning** (`/planning`) · **IPTU** (`/iptu-property`) · **Favorites** (`/favorites`) | ✅ concluído | 14 |
| 11 | **Dashboard** (`/dashboard`) | ✅ concluído | 21 |
| 12 | **Public** (`/public/:slug`) · **Backup** (`/backup`) | ✅ concluído | 39 |
| 13 | **Auditoria + Permissões + Relatórios Financeiros + Grupos de Usuário** (`/audit-logs`, `/permissions`, `/financial-audit`, `/financial-reports`, `/user-groups`) ⚠️ nunca inventariado antes de 2026-08-12 | ✅ concluído | — |

**`tsc --noEmit`: 0 erros · `npm run lint`: 0 erros/warnings nos arquivos do Módulo 13** (o backlog de lint pré-existente em outros módulos — `any` em repositories antigos — não foi tocado nesta rodada, é dívida técnica anterior).

### ➡️ ONDE ESTAMOS AGORA
**Módulo 13 concluído** — os 5 grupos de rota que nunca haviam sido inventariados (ver aviso no topo) foram portados do zero, seguindo o mesmo padrão Clean Architecture dos módulos 1-12. Detalhe completo em §2.13. Pré-requisito de todos eles: sincronização do `prisma/schema.prisma`, que estava desatualizado em relação ao banco real (ver §2.13.0) — feita via `prisma migrate diff` **somente-leitura** antes de qualquer alteração de schema, para não arriscar dados de produção.

✅ **Os 8 módulos pendentes (documentados em §4.5) foram conectados em 2026-08-13.** A auditoria de 2026-08-12 tinha encontrado 33 arquivos de negócio real ainda em `fetch`/`authFetch` cru, cobrindo create/edit de Leases, Users/Administradores, Companies/Empresas, Agencies/Imobiliárias, Property-types/Tipo-imóvel, Owners/Proprietários, Tenants/Inquilinos, Properties/Imóveis, mais 5 widgets de dashboard financeiro e o `ContactManager` compartilhado. **Todos os 8 + os 5 widgets + `ContactManager` foram conectados às Server Actions**, incluindo `properties` (o caso mais difícil — upload multipart, sem action antes; agora usa `createUnifiedPropertyAction`/`updateUnifiedPropertyAction` com `FormData`) e o branding/`AssetUploader` (trocou `useUploadSSE` por `uploadOwnBrandingAssetAction`/`uploadCompanyBrandingAssetAction`). Verificado nesta revisão: `grep -rln "authFetch(" src` retorna só o próprio `utils/authFetch.ts` (a definição, sem chamadores); `grep -rn "NEXT_PUBLIC_URL_API" src` retorna só 4 comentários + `FetchInterceptor.tsx` (infra deliberada) + `app/api/lead/route.ts` (ver nota abaixo). Detalhe completo em §4.5.

⚠️ **`/api/lead` não é mais "dependência do Express" no sentido funcional** — a rota chama `${NEXT_PUBLIC_URL_API}/leads`, mas **esse endpoint não existe no backend Express atual** (`grep -rn "leads" api-nairim-v2/src` = zero resultados). O formulário de contato da vitrine pública provavelmente falha silenciosamente (erro capturado e engolido) independente do Express estar ligado. Não é bloqueador para desativar o Express, mas é uma feature quebrada que precisa de decisão: implementar `/leads` em algum lugar (Server Action? tabela nova?) ou remover o formulário.

**Não portado (sem consumidor, decisão antiga, ver Módulos 10-11): `GET /dashboard/all`**, Favorites. **Próximos passos:** (1) decidir o destino de `/api/lead` (achado acima), (2) a **validação end-to-end** contra Postgres real (nunca feita — ver §4, banco não estava acessível deste ambiente no momento desta auditoria) — este é agora o **principal bloqueador** antes de desativar o Express, (3) resolver o bug pré-existente (não desta rodada) de hook condicional em `DataTable/index.tsx` (ver §3), (4) remover lixo de sessão (`check-db.tmp.ts`, `.code-workspace` perdido — ver §3), (5) só então reavaliar desativar o Express (§5).

### ⚠️ Achados relevantes — Módulo 8 (Leases)
1. **`getNextInternalCode` de Tenants** (achado durante a migração do Módulo 8, não fazia parte do mapeamento original do Módulo 6): endpoint `GET /tenants/next-internal-code` existia no Express e não tinha sido portado. Portado nesta rodada: calcula MAX numérico dos `internal_code` da empresa + 1 (ignora códigos não numéricos). Substituiu, na tela de cadastro de inquilino, o antigo `sort[internal_code]=desc` do front, que ordenava a string lexicograficamente ("9" > "12") e sugeria códigos já usados — bug do front corrigido de brinde ao portar o endpoint real.
2. **`agency_commission`**: a tela de cadastro/edição de locação envia esse campo no payload, mas ele **não existe** no schema Prisma nem no `LeaseService` original — o backend Express simplesmente ignora. Comportamento preservado (o campo é aceito e descartado, não persistido).
3. **Cancelamento de locação**: soft-delete das transações **confirmadas** a partir da data informada (as `PENDING` seguem regidas pela sincronização normal), encargo financeiro opcional (`is_cancellation_charge`), marca `CANCELED`, libera o imóvel **somente** se não houver outra locação ativa nele. O fornecedor-espelho da imobiliária é localizado/criado com `internal_code: AG-${agencyId.slice(0,8)}`.
4. **Sincronização financeira é idempotente**: chave = primeira palavra da descrição + número da parcela. Lançamentos `PENDING` são regenerados a cada update; `COMPLETED` são preservados intocados. Falha na sincronização **não invalida** a locação já criada/atualizada — vira um `finance_warning` anexado ao retorno da Server Action.
5. **Documentos de locação (contrato)** não passam por conversão AVIF (diferente das imagens de imóveis do Módulo 7) — upload simples via `Storage.upload`.
6. **Extensão no `DynamicFormManager`**: ganhou prop opcional `fetchResource?: (id: string) => Promise<any>` para as telas de edição/visualização de locação carregarem o registro via Server Action em vez do fetch HTTP interno padrão do componente. Retrocompatível — módulos ainda não migrados continuam usando o fetch antigo (prop omitida).

### ⚠️ Achados relevantes (ler antes de mexer nos módulos citados)

**Módulo 6 (Owner/Tenant):** `OwnerService` e `TenantService` do backend **não são simétricos** apesar de parecerem: Owner faz exclusão mútua PF/PJ (zera CNPJ ao gravar CPF e vice-versa) e verifica existência antes do delete (404 amigável); Tenant **não faz nenhuma das duas coisas** — grava CPF+CNPJ simultaneamente se enviados, e deixa o delete de um id inexistente estourar erro cru do Prisma. Preservado de propósito — ver CHANGELOG (Módulo 6).

**Módulo 7 (Properties) — duas decisões de arquitetura que afetam módulos futuros com upload (Leases/Módulo 8):**
1. **Upload síncrono**: Server Actions não suportam "responder antes do upload terminar + processar em background" (padrão busboy do Express). A action só retorna quando TUDO terminou, incluindo conversão AVIF.
2. **`useUploadSSE` foi trocado por chamada direta à Server Action** nas telas que migraram — Server Actions não são URLs chamáveis por XHR, então perdeu-se a barra de progresso de bytes (fica um spinner genérico). `useUploadSSE`/`UploadProgressOverlay` continuam existindo para o que ainda não migrou (ex: `AssetUploader` do Branding).
3. Escopo cortado para o que o front realmente chama: as rotas de CRUD "normal" (JSON, sem upload) e o endpoint separado de documentos existem no backend mas nunca são usados pelo front — não foram portados (ver CHANGELOG Módulo 7 para a lista completa de código morto identificado).

---

## 2. Detalhe do que falta por módulo (endpoints a migrar)

> Cada módulo segue o mesmo roteiro: ler controller+service+validator no Express → `core` (entities/use-cases/repo interface) → `infra` (repo Prisma + factory) → `shared/validators` (Zod) → `server/actions` (mutação) + `server/queries` (leitura) → refatorar as telas do módulo → testes → atualizar CHANGELOG → **parar e pedir validação**.

### Módulo 5 — Agencies (`src/controllers/AgencyController.ts`, `AgencyService.ts` ~716 linhas)
`GET /agencies` · `GET /agencies/filters` · `GET /agencies/suggestions/contacts` · `GET /agencies/:id` · `POST /agencies` · `PUT /agencies/:id` · `DELETE /agencies/:id` · `PATCH /agencies/:id/restore`. Tenant-scoped. Tem endereço (`AgencyAddress`) e contatos (`Contact`).

### Módulo 6 — Owners + Tenants
- **Owners** (`OwnerService.ts` ~800): `GET /` · `/filters` · `/:id` · `/suggestions/contacts` · `POST /` · `PUT /:id` · `DELETE /:id` · `PATCH /:id/restore`.
- **Tenants** (`TenantService.ts` ~660): mesma forma + `/suggestions/contacts`.
- Ambos com endereço + contatos, tenant-scoped.

### Módulo 7 — Property-types + Properties ✅ CONCLUÍDO
- **Property-types**: CRUD + filters + restore (com cascata para Property/Lease no delete). ✅
- **Properties** (fluxo unificado, único usado pelo front): `create-unified`, `update-unified`, `GET /`, `GET /filters`, `GET /:id`, delete, restore. ✅ Upload síncrono com conversão AVIF (`infra/storage/image-converter.ts` + `MinioStorage.uploadMedia`). `useUploadSSE` trocado por chamada direta à Server Action nas telas migradas.
- **Não portado (código morto ou não usado pelo front)**: CRUD "normal" sem upload, endpoint separado de documentos (`DocumentService`), `PropertyService.createPropertyWithFiles`/`createUnifiedProperty`(método)/`updatePropertyWithFiles`, `DocumentService.setFeaturedDocument`. Ver CHANGELOG Módulo 7 para a lista completa.
- `AssetUploader`/`useUploadSSE`/`MinioService` streaming multipart (`@aws-sdk/lib-storage`) para vídeos grandes **não foram portados** — o upload de imóveis hoje usa buffer em memória (arquivo inteiro), suficiente para o caso de uso atual mas não testado com vídeos grandes. Revisar se necessário.

### Módulo 8 — Leases (`LeaseService.ts` ~977 + `LeaseFinanceService.ts` ~327) ✅ CONCLUÍDO
`GET /` · `/filters` · `/:id/cancellation-preview` · `/:id` · `POST /:id/cancel` · CRUD · `DELETE /:id/permanent` · `PATCH /:id/restore` · `PUT /:id/documents` (upload) — todos portados como Server Actions/queries (`src/server/actions/lease.ts`, `src/server/queries/lease.ts`). Sincronização financeira (aluguel/comissão/IPTU) portada fielmente em `src/infra/repositories/prisma-lease-finance-repository.ts`. Telas `locacoes/cadastrar`, `locacoes/editar/[id]`, `locacoes/visualizar/[id]`, `LeaseCancellationModal` e as ações de locação do `DataTable` migradas para SSR — chamam imóveis/inquilinos/imobiliárias já migrados (Módulos 5-7) via Server Action; só `financial-institution`/`financial-category`/`financial-subcategory`/`financial-center`/`financial-supplier` seguem via HTTP até o Módulo 9. 20 testes de use-case (`src/core/use-cases/lease/__tests__/lease-use-cases.test.ts`), cobrindo CRUD, cancelamento e os warnings de negócio/IPTU do `validateLeaseBusinessRules`.

### Módulo 9 — Financeiro (ordem sugerida)
1. `financial-institution` (`FinancialIntitucion.ts` ~282) — CRUD + `/filters` + `/balance-summary` + `/quick-create` + restore. ✅
2. `financial-category` (`CategoryService.ts` ~192) — CRUD + `/filters` + `/quick-create` + restore. ✅
3. `financial-subcategory` (`SubcategoryService.ts` ~299). ✅
4. `financial-card` (`CardService.ts` ~346) — + `/usage`. ✅
5. `financial-center` (`CenterService.ts` ~180). ✅
6. `financial-supplier` (`SupplierService.ts` ~542) — + endereço. ✅
7. `financial-transaction` (`TransactionService.ts` **~1314**) — CRUD + `/transfer` + `/installments` + `/recurrence` + `/:id/related` + **agregações** (`/monthly-summary`, `/monthly-summary-multi`, `/available-years`, `/expense-by-category`, `/subcategory-breakdown`) + **anexos do lançamento** (`/:id/documents` — list/upload/delete) portados como Server Actions/queries; grid de lançamentos (list/filters/save/create/delete/duplicate/Parcelado/Recorrente) e gráficos do dashboard/hooks (useMonthlySummary/Multi/AvailableYears, ExpenseByCategoryChart, SubcategoryBreakdownChart, TransactionAttachmentsModal) migrados para SSR. ✅ (não portados por falta de consumidor no front: `POST /recurring/generate-next` e `DELETE /group/:group_id` — ver CHANGELOG 9g-i)
8. `financial-invoice` (`InvoiceService.ts` ~390) — `GET /` (por card+mês+ano) · `POST /` · `/card/:cardId` · `PUT /:id/status` · `/:id/transactions`. ✅

### Módulo 10 — Planning + IPTU + Favorites ✅
- **Planning** (`PlanningService.ts` ~845): `/dashboard` · list · `/:id` · `POST /` · `POST /create` · `PUT /:id` · `DELETE /:id` (`Planning`+`PlanningMonth`). Portados os endpoints **consumidos** pelo front: `GET /planning/dashboard` (dashboard completo: saldos mensais/acumulados, categorias `incomes`/`expenses` com subcategorias, totais globais) e `POST /planning` (upsert) + `DELETE /planning/:id` — como `getPlanningDashboardAction`/`upsertPlanningAction`/`deletePlanningAction` (Server Actions). Consumidores migrados: `planejamento/content.tsx`, `PlanningEditModal`, `RealizedVsPlannedChart`, `PlanningSubcategoryBarChart`. Não portados (sem consumidor): `GET /planning` (lista), `GET /planning/:id`, `POST /planning/create`.
- **IPTU** (`IptuPropertyService.ts` ~173): só `GET /iptu-property/filters` → `getIptuPropertyFiltersAction`; `DataTable` ganhou prop opcional `filtersFetcher` e `IptuManager` a usa. ✅
- **Favorites** (`FavoriteService.ts` ~437): `GET /` · `/:id` · `POST /` · `DELETE /:id` · `/delete-by-user-property` · `/:id/restore` · `/user/:user_id` · `/check` — **NÃO portado**: nenhum componente/hook do front chama `/favorite*` (grep sem consumidores). Portar no próximo módulo se surgir uso.

### Módulo 11 — Dashboard (`DashboardService.ts` ~353) ✅ CONCLUÍDO
`GET /dashboard/financial` · `/portfolio` · `/clients` · `/map` · `/all`. Agrega vários domínios (veio depois deles, como planejado).
- Portados (via Server Action `getDashboardSectionAction` + query `getDashboardSectionData`): as 4 seções consumidas pelo front. Entidades em `core/entities/dashboard.ts`; helpers puros de cálculo (`calcVariation` ±100%, `getPeriodDatesIn`, `calculateVacancyMonths`, `decimalToNumber`) em `core/utils/dashboard-metrics.ts`; portes 1:1 do `DashboardService` em `infra/repositories/prisma-dashboard-repository.ts`; validação Zod (`shared/validators/dashboard.ts`) com as mesmas mensagens do `validateDashboardParams`.
- Front refatorado: `fetchSection` (lib/dashboard.ts) → `getDashboardSectionAction` (removeu HTTP/`NEXT_PUBLIC_URL_API`/token); `app/dashboard/page.tsx` pré-carrega `financial` via query; `DashboardClient` sem `useAuth`/token.
- **Não portado (sem consumidor)**: `GET /dashboard/all` (o dashboard usa as 4 rotas separadas). Portar agregando as 4 chamadas se surgir uso.
- 21 testes de use-case (`src/core/use-cases/dashboard/__tests__/dashboard-use-cases.test.ts`): período/validação fiel ao validator + helpers puros + delegação.

### Módulo 12 — Public + Backup ✅ CONCLUÍDO
- **Public** (`PublicService.ts` ~195, sem JWT, resolve empresa por slug): portado como queries/actions `getPublic*Data/Action` em `src/server/queries/public.ts` + `src/server/actions/public.ts`. O tenant vem do slug da URL (`getCompanyBySlug` → `runWithTenant`), não da sessão. `/properties`, `/properties/available`, `/properties/:id`, `/property-types` são consumidos pelo front (home `page.tsx`, `PropertyFilter`, `property-service.ts`); `/owners` e `/agencies` têm query/use-case prontos mas **sem consumidor** (documentado). `PropertyDetail`/`PropertyList`/`ApartmentRentals`/`HouseRentals` seguem inalterados pois usam o mesmo `propertyService`.
- **Backup** (`BackupService.ts` ~509, requireAdmin): portado como Server Actions `exportBackupAction`/`restoreBackupAction`/`listAutoBackupsAction`/`downloadAutoBackupAction` em `src/server/actions/backup.ts` com guarda `withTenant(role:'admin')`. `exportCompany` e a transação destrutiva `restoreCompany` portados 1:1 em `infra/repositories/prisma-backup-repository.ts` (ordem FK-safe, `address`/`user` via upsert, religação de `Transaction.parent_transaction_id`); disco `infra/storage/node-backup-file-store.ts` (anti-path traversal). `next.config.ts` ganhou `serverActions.bodySizeLimit: '50mb'`. Página `configuracoes` (export/restore/auto) 100% Server Actions, sem `authFetch`. ⚠️ Restore é destrutivo — validar end-to-end antes de usar em produção.

### Módulo 13 — Auditoria + Permissões + Relatórios Financeiros + Grupos de Usuário ✅ CONCLUÍDO (2026-08-12)

⚠️ **Origem diferente dos módulos 1-12**: este módulo não veio do roteiro original de `MIGRATION_MAP.md` (que só cobria até o Módulo 12). Foi descoberto via auditoria de código em 2026-08-12 — os 5 grupos de rota abaixo existem no Express, estão montados em `routes/index.ts`, têm controllers reais e telas consumidoras no front, mas **nunca apareceram em nenhum documento de migração**. Escopo e decisões de arquitetura confirmados com o usuário antes de codar (ver plano em `C:\Users\Marcio\.claude\plans\mutable-tumbling-backus.md`, mantido como referência histórica).

**§2.13.0 — Pré-requisito: sincronização do `prisma/schema.prisma`**
O schema do front estava desatualizado em relação ao schema real do backend (que o banco de produção já refletia, criado pelo Express) — faltavam **6 models inteiros** (`UserGroup`, `UserGroupPermission`, `UserAccessSchedule`, `AuditLog`, `IptuAuditSettings` + enum `AuditAction`) e uma extensão grande em `User` (`user_group_id`, `is_active`, `photo_url`, campos de telefone, `has_time_restriction`, relações de auditoria). Copiados 1:1 do backend.
- ⚠️ **Quase-incidente evitado**: antes de aplicar qualquer migration, um `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` (comando **somente-leitura**, não altera nada) revelou que rodar `migrate dev` **teria apagado 4 colunas reais com dados** que já existiam no banco (criadas pelo Express) mas nunca tinham sido adicionadas ao schema do front: `Company.db_quota_mb`, `Agency.commission_percentage`, `Lease.agency_commission`, `Transaction.installment_group_id` (+ 2 índices). Resolvido adicionando essas definições ao schema **em vez de** rodar a migration — o diff final ficou **vazio**: nenhuma migration foi necessária, só `npx prisma generate` para regenerar o client. **Lição:** sempre rodar o diff somente-leitura antes de qualquer `migrate dev`/`migrate deploy` quando o schema tiver ficado dessincronizado por mais de uma sessão.

**§2.13.1 — Infra compartilhada de permissões** (pré-requisito dos 5 grupos)
- `src/shared/utils/menu-resources.ts` — porte estático de `api-nairim-v2/src/lib/menuResources.ts`: catálogo `MENU_RESOURCES` (21 entradas), `PERMISSION_ACTIONS`, `ACTION_COLUMN`.
- `src/core/repositories/user-group-permissions-repository.ts` + `src/infra/repositories/prisma-user-group-permissions-repository.ts`: `resolveForUser(userId)` retorna `Map<resource, Set<action>> | null` (`null` = sem restrição). Cache em `Map` com **TTL 60s em memória**, igual ao Express — justificado porque o deploy é Node/Docker self-hosted persistente (confirmado em `docker-compose.yml`), não serverless. `invalidateCache()` chamado ao salvar diretivas.
- `src/infra/auth/session.ts` ganhou `withPermission(resource, action, fn)` — **função nova, irmã de `withTenant`, não uma extensão dele** (decisão deliberada para não arriscar os 12 módulos já em produção que só usam `withTenant`/role). Regra: `SUPER_ADMIN` sempre bypassa; `resolveForUser` retornando `null` libera; senão checa `perms.get(resource)?.has(action)` e lança `ForbiddenError` se faltar. **Papel ADMIN não tem bypass automático** — é a regra de segurança central deste módulo, validar com atenção redobrada no teste manual (§4).

**§2.13.2 — `/audit-logs`** (só leitura — log é gerado pelo sistema, sem criar/editar/excluir)
`core/entities/audit-log.ts`, `core/use-cases/audit-log/queries.ts`, `infra/repositories/prisma-audit-logs-repository.ts` (replica `buildWhereClause`/`ACTION_LABELS`/`prettifyFieldName` do Express), `server/queries|actions/audit-log.ts`. Guarda: `withPermission('audit-logs', 'view')`. Front: entry `audit-logs` em `tableDataSources.ts`; `AuditLogDetailModal` trocado de fetch cru para action.

**§2.13.3 — `/permissions/me`** (reaproveita a infra do §2.13.1)
`core/use-cases/permission/get-my-permissions.ts` + `server/actions/permission.ts` → `getMyPermissionsAction()`. Front: `PermissionsContext.tsx` trocou `fetch('/permissions/me')` pela action, **preservando o fallback otimista** (erro/pendente → `{unrestricted:true, resources:{}}`, nunca trava a UI — decisão de produto do backend original, não nova).

**§2.13.4 — `/financial-audit`** (Auditoria de IPTU)
`core/entities/iptu-audit.ts`, `core/use-cases/iptu-audit/{settings,report}.ts`, `infra/repositories/prisma-iptu-audit-repository.ts`, `server/queries|actions/iptu-audit.ts`. Guarda: `withPermission('financial-audit', 'view'|'edit')`.
- ⚠️ **Bug herdado deliberadamente, NÃO corrigido**: `buildSideWhere` exige `lease_id: { not: null }` nos dois lados (receita e despesa) da query de transações — é a causa raiz confirmada do relato do cliente de que a auditoria "só considera 1-2 imóveis". Preservado de propósito porque a correção é estrutural (mudaria o fluxo de lançamento/schema), fora do escopo de um port 1:1. Documentado em comentário no código (`prisma-iptu-audit-repository.ts`) e aqui — **próxima pessoa que mexer neste módulo deve tratar isso como item de backlog, não como algo já resolvido**.
- Front: `content.tsx` e `IptuAuditSettingsModal.tsx` migrados para actions.

**§2.13.5 — `/financial-reports`** (4 relatórios: grouped, extrato, income-expense, demonstrativo)
`core/entities/financial-report.ts`, `core/use-cases/financial-report/aggregations.ts`, `infra/repositories/prisma-financial-reports-repository.ts` (porta `buildBaseWhere`/`mapItem`/`groupKeyOf`/`buildGroups`/`computeSaldoAnterior`), `server/queries|actions/financial-report.ts`. Guarda: `withPermission('financial-reports', 'view')`.
- ⚠️ **Nomenclatura deliberadamente singular** (`financial-report.ts`, nunca `financial-reports.ts`) em todas as camadas novas — já existiam `core/use-cases/financial-transaction/reports.ts` / `server/queries/financial-reports.ts` / `shared/validators/financial-reports.ts` de **outro recurso** (agregações do Dashboard/`TransactionController`), sem sobreposição de rota mas nome parecido. Não renomear os arquivos deste módulo para plural sem checar essa colisão.
- Preserva `financialInstitution` em **camelCase** na resposta de cada item (não normalizado para snake_case — o front já espera assim).
- **Regressão encontrada e corrigida nesta rodada**: o teto de validação de intervalo de datas estava em **365 dias** em dois arquivos (`shared/validators/dashboard.ts`, `core/use-cases/dashboard/crud.ts`), mas o backend real já tinha sido ampliado para **5480 dias (~15 anos)**. Era regressão silenciosa de quando o Dashboard (Módulo 11) foi migrado — corrigida nos dois arquivos. O validador **novo** deste módulo (`shared/validators/financial-report.ts`) já nasceu com 5480 dias, sem reaproveitar `dashboardParamsSchema` cegamente.
- Front: `GroupedReportView.tsx`, `ExtratoView.tsx`, `IncomeExpenseView.tsx`, `DemonstrativoView.tsx` migrados para actions.

**§2.13.6 — `/user-groups`** (o maior do módulo: CRUD + matriz de permissões + clone)
`core/entities/user-group.ts` + `user-group-permission.ts`, `core/use-cases/user-group/{crud,clone,permissions}.ts`, `infra/repositories/prisma-user-groups-repository.ts` (busca/ordenação acento-insensível em memória, aceita `sort[campo]` e o legado `sort_campo`), `server/queries|actions/user-group.ts`.
- `UserGroupPermission` **não tem soft delete** — `upsertPermissionsAction` sempre apaga tudo e recria dentro de uma transação (`deleteMany`+`createMany`), replicando o Express.
- Clone é transacional e não-destrutivo: cria grupo novo + copia as permissões da origem. Guarda `withPermission('user-groups', 'create')` — não `edit`, porque clonar cria um registro novo.
- `restoreUserGroupAction` portado por paridade de API (existe no Express) mas **nenhuma tela do front o usa** — não foi construída UI nova para ele.
- Front: as 4 telas de `grupos-usuario/**` (listagem via `tableDataSources.ts`, cadastrar/editar/visualizar via `DynamicFormManager` + `fetchResource={getUserGroupByIdAction}`), `PermissionMatrix/index.tsx` (dois `useEffect` independentes: catálogo de recursos ao montar + diretivas salvas do grupo quando `groupId` é passado), `CloneUserGroupModal/index.tsx`, `useUserGroupOptions.ts` (hook usado fora deste módulo, no cadastro de Administrador) — todos migrados de `fetch`/`authFetch` cru para Server Actions.

**Verificação deste módulo**: `npx tsc --noEmit` = 0 erros e `npm run lint` = 0 erros/warnings novos em todos os arquivos acima, checados lote a lote. Sem testes unitários novos (o módulo não seguiu o padrão `__tests__` dos módulos 1-12 nesta rodada — pendência, ver §4).

---

## 3. Itens transversais (fora da numeração — decidir quando encaixar)

- **Infra de UI compartilhada (grande alavanca):** `src/components/table/DataTable/index.tsx` e `src/components/form/DynamicForm` (`DynamicFormManager`) já suportam injeção de Server Action via prop (`resourceSource`/`onSubmit`/`fetchResource`) — usado agora por praticamente todos os módulos (ver §4.5).
- **Uploads:** `src/components/admin/WhiteLabel/AssetUploader.tsx` foi migrado (2026-08-13) de `useUploadSSE`/fetch cru para Server Actions (`uploadOwnBrandingAssetAction`/`uploadCompanyBrandingAssetAction`) — perdeu a barra de progresso de bytes (spinner genérico), mesmo trade-off já aceito no Módulo 7 para imóveis. `useUploadSSE`/`UploadProgressOverlay` ficam sem consumidor conhecido depois disso — candidatos a remoção se confirmado.
- **Segurança:** cookie `authToken` → httpOnly quando não houver mais `authFetch` client-side. Confirmado em 2026-08-13: `authFetch()` não tem mais nenhum chamador em `src/` — reavaliar se o cookie ainda precisa ser não-httpOnly.
- **Reset de senha por e-mail:** nunca implementado (decisão: manter). Rever se for exigido.
- 🧹 **Código morto confirmado (auditoria 2026-08-12):** `src/hooks/useTableData.ts`, `src/hooks/useFetchItem.ts`, `src/hooks/useDynamicForm.ts` (o hook, não o componente `components/form/DynamicForm`) — os 3 sem nenhum import em uso no projeto. Candidatos a remoção.
- 🧹 **Lixo de sessão sem `.gitignore` (achado 2026-08-13):** `check-db.tmp.ts` (raiz do projeto — script de diagnóstico Prisma, lê contagem de registros por `company_id`, não destrutivo mas não deveria estar versionado) e `src/components/table/InlineEditableTable/front-nairim-v2.code-workspace` (arquivo de workspace do VSCode, claramente salvo no diretório errado por engano). Nenhum dos dois foi removido nesta auditoria — não apagar código/config do usuário sem confirmação; sinalizar para remoção manual ou adicionar ao `.gitignore`.
- ⚠️ **Bug real pré-existente (achado 2026-08-13, não corrigido — fora do escopo desta auditoria):** `src/components/table/DataTable/index.tsx`, linha ~269-281 — o hook `useOptimizedTableData` é chamado dentro de um ternário condicional (`useLocalMode ? {...} : useOptimizedTableData(...)`), violando as Regras dos Hooks do React. Se `useLocalMode` (`!!localData`) mudar de valor entre renders da mesma instância do componente, o número de hooks executados muda, o que pode corromper estado ou causar warnings/crashes do React. Não é uma regressão desta rodada — já existia antes. Precisa de correção dedicada (reestruturar para sempre chamar o hook e decidir depois qual resultado usar), não um fix de passagem.
- ⚠️ **`/api/lead` (Route Handler, `src/app/api/lead/route.ts`):** encaminha para `${NEXT_PUBLIC_URL_API}/leads`, mas esse endpoint **não existe** no backend Express atual (confirmado via grep em `api-nairim-v2/src`, zero resultados). O formulário de contato da vitrine pública provavelmente falha silenciosamente. Decisão pendente: implementar `/leads` como Server Action + tabela nova, ou remover a feature.
- **Rotina de env:** manter `.env` / `ENV.md` sincronizados ao adicionar vars.

---

## 4. ⚠️ Dívida de validação (IMPORTANTE)

**Nenhum módulo foi validado end-to-end** (contra o Postgres real, no navegador). Só há `tsc` + testes unitários de use-case (com fakes) — e o Módulo 12 tem o restore destrutivo que exige atenção redobrada. Antes de confiar em produção, subir:
```bash
cd C:/Users/Marcio/Desktop/front-nairim-v2 && npx next dev
```
com o Postgres de `DATABASE_URL` acessível, e testar: login, refresh, branding (tema/white-label), CRUD de empresas, CRUD de usuários, persisteência de preferências de coluna/layout, vitrine pública (`/public/:slug`) e um ciclo completo de backup: **exportar → alterar dados → restaurar → conferir** (o auto-backup gerado permite reverter).

**Módulo 13 (adicional a testar, checklist do plano original):**
1. **Guard de permissão** (mais sensível): logar como ADMIN sem grupo (deve ver tudo), ADMIN com grupo restrito (deve respeitar a matriz), SUPER_ADMIN (bypass sempre) — testar os 3 casos em pelo menos uma tela de cada um dos 5 grupos.
2. **Auditoria (Logs)**: listar, filtrar, abrir detalhe de um log de `UPDATE` (conferir `changed_fields` traduzido em PT-BR).
3. **Auditoria de IPTU**: configurar categorias, gerar relatório, conferir que bate com os lançamentos que têm `lease_id` preenchido — e confirmar visualmente a limitação já documentada (§2.13.4) nos que não têm.
4. **Relatórios Financeiros**: gerar os 4 (grouped/extrato/income-expense/demonstrativo) com filtros variados, conferir Saldo Anterior e o alerta de despesas não classificadas no Demonstrativo.
5. **Grupos de Usuário**: criar grupo, configurar matriz, editar, clonar (conferir que a permissão clonada bate com a origem), confirmar que `PermissionMatrix` em modo `disabled` (tela de visualizar) não permite editar.

---

## 4.5. ✅ Inventário do que dependia do Express — RESOLVIDO em 2026-08-13 (histórico: auditoria 2026-08-12)

**Pergunta original:** "o front está 100% independente, dá pra desligar o Express?" → em 2026-08-12 a resposta era **NÃO**, quantificada abaixo. Em **2026-08-13** todos os 8 módulos foram conectados e verificados (`tsc --noEmit` 0 erros, lint sem novos problemas nos arquivos tocados). Estado atual: `grep -rln "authFetch(" src` só retorna a definição do helper (`utils/authFetch.ts`), sem chamadores; `grep -rn "NEXT_PUBLIC_URL_API" src` só retorna comentários + `FetchInterceptor.tsx` (infra deliberada, mantida como salvaguarda) + `app/api/lead/route.ts` (rota morta — ver §1). **Mantendo a tabela original abaixo como histórico**, com status atualizado em cada linha — útil para quem quiser conferir *como* cada módulo foi resolvido.

| Módulo | O que faltava (2026-08-12) | Resolvido em 2026-08-13 |
|---|---|---|
| **Leases** (locações) | Cadastrar, editar, excluir permanente, cancelamento (`LeaseCancellationModal`) | ✅ conectado a `lease.ts` |
| **Users** (administradores) | Cadastrar, editar, ativar/desativar, foto (`UserPhotoField`), jornada de acesso (`AccessScheduleGrid`) | ✅ conectado a `user.ts` |
| **Companies** (empresas) | Cadastrar, editar, visualizar, white-label/branding (`WhiteLabelManager`) | ✅ conectado a `company.ts`; `AssetUploader` reescrito de `useUploadSSE` para `uploadOwnBrandingAssetAction`/`uploadCompanyBrandingAssetAction` |
| **Agencies** (imobiliárias) | Cadastrar, editar | ✅ conectado a `agency.ts` |
| **Property-types** (tipo de imóvel) | Cadastrar, editar | ✅ conectado a `property-type.ts` |
| **Owners** (proprietários) | Cadastrar, editar | ✅ conectado a `owner.ts` |
| **Tenants** (inquilinos) | Cadastrar, editar | ✅ conectado a `tenant.ts` |
| **Properties** (imóveis) | Cadastrar, editar (upload multipart via `useUploadSSE`, endpoints `create-unified`/`update-unified`) | ✅ novas actions `createUnifiedPropertyAction`/`updateUnifiedPropertyAction` (`FormData` + `readPropertyUploadFiles`) — era o caso mais difícil da lista, resolvido |
| **Dashboard financeiro** | 5 widgets: `StorageUsageChart`, `DatabaseUsageChart`, `TenantTenureChart`, `CardUsageChart`, `AccountBalanceChart` | ✅ todos conectados (ex.: `getFinancialInstitutionBalanceSummaryAction` nova) |
| **Relatórios (opções)** | `useReportOptions.ts`, `reportPrintHeader.ts` | ✅ conectados |
| **ContactManager** (compartilhado) | Sugestões de contato | ✅ conectado a `getOwnerContactSuggestionsAction`/`getTenantContactSuggestionsAction`/`getAgencyContactSuggestionsAction` |

**Lição que continua valendo:** para `users`, `companies` e `properties` a *listagem* já usava Server Action antes de create/edit serem migrados — testar só a listagem nunca foi evidência de módulo completo. Ao auditar qualquer módulo no futuro, confirmar sempre create + edit + delete, não só list.

**Pendências reais que sobraram** (não fechadas por este trabalho, ver §1 para detalhe):
1. `/api/lead` chama um endpoint (`/leads`) que não existe no Express atual — feature quebrada, decisão de produto pendente, não é dependência do Express em si.
2. Bug pré-existente (não desta rodada) em `DataTable/index.tsx`: `useOptimizedTableData` é chamado dentro de um ternário condicional — viola Regras dos Hooks. Ver §3.
3. Validação end-to-end contra Postgres real nunca foi feita para nenhum módulo — **feita em 2026-08-13, ver §4.6**.
---

## 4.6. 🔴 Validação E2E contra Postgres/MinIO reais (2026-08-13) — 2 bugs sistêmicos encontrados e corrigidos

Depois de conectar os 8 módulos (§4.5), rodei `npx next dev` contra o banco e o MinIO reais, logado como usuário de teste, navegando de verdade (Playwright + inspeção manual de screenshots) pelas telas dos módulos recém-conectados. Isso é o primeiro teste end-to-end real de qualquer módulo desde o início da migração (a dívida documentada em §4 desde a fundação do projeto).

### Achado 1 — `limit` acima de 100 quebrava ~13 telas com 500

**Causa:** todos os validadores Zod de listagem (`owner`, `property-type`, `agency`, `financial-institution`, `financial-card`, `financial-center`, `financial-supplier`, `financial-category`, `financial-subcategory`, `tenant`) têm `.max(100)`. No Express original esse teto era **inconsistente** — alguns controllers o impunham de verdade (ex.: `property-type`), outros declaravam o validador mas nunca o chamavam na listagem (ex.: `owner`, `agency`, `audit-log`), e `financial-center` nunca teve teto nenhum. O port unificou tudo sob o mesmo schema Zod, que **sempre** valida — então qualquer tela que buscava opções de formulário com `limit: 500` ou `limit: 1000` (para "trazer tudo de uma vez" nos selects) passou a quebrar com erro 500 fatal em SSR.

**Onde foi corrigido** (todos os `limit` acima de 100 reduzidos para 100): `imoveis/_lib/propertyData.ts`, `imobiliarias/_lib/agencyFinancialOptions.ts`, `locacoes/cadastrar/page.tsx`, `locacoes/editar/[id]/page.tsx`, `locacoes/visualizar/[id]/page.tsx`, `financeiro/cartoes/page.tsx`, `financeiro/categorias/page.tsx`, `financeiro/centros/page.tsx`, `financeiro-auditoria/_components/IptuAuditSettingsModal.tsx`, `financeiro/fornecedores/page.tsx`, `financeiro/instituicoes-financeiras/page.tsx`, `financeiro/lancamentos/page.tsx`, `relatorios/_lib/useReportOptions.ts`, `SubcategoryBreakdownChart/index.tsx`, `LeaseCancellationModal/index.tsx`. Também corrigido `AuditoriaTable.tsx` (`defaultLimit={150}` → `100`, Módulo 13 — aqui o teto de 100 **é** fiel ao Express, `AuditLogValidator` só não era chamado na listagem original, ver comentário em `shared/validators/audit-log.ts`).

**Se alguma empresa tiver mais de 100 proprietários/tipos/imobiliárias/categorias ativas simultaneamente**, essas telas de formulário vão mostrar só os 100 primeiros — não é o comportamento ideal a longo prazo, mas é seguro (não quebra) e é o mesmo tipo de limitação que o Express já tinha em `property-types`. Paginar ou aumentar o teto do validador é trabalho futuro, não corrigido aqui.

### Achado 2 — objetos `Decimal` do Prisma quebrando o boundary RSC (mais sério)

**Causa:** campos `@db.Decimal` no schema Prisma (`Property.values[].purchase_value/market_value/rental_value/condo_fee/property_tax/sale_value/extra_charges`, `PropertyIptu.property_tax*` (4 campos), `Lease.*` (11 campos: rent_amount, condo_fee, property_tax, extra_charges, commission_amount, agency_commission, cancellation_penalty, other_cancellation_amounts, property_tax_cash, property_tax_first/second_installment), `Agency.commission_percentage`, `Transaction.amount`) são retornados pelo Prisma como **instâncias da classe `Decimal`** (com métodos), não `number` puro. Passar isso de um Server Component para um Client Component é inválido no React Server Components — quebra com `"Only plain objects can be passed to Client Components from Server Components. Decimal objects are not supported"`, no console do browser (não sempre um erro HTTP visível, o que torna esse bug fácil de não notar sem testar de verdade).

**Por que passou despercebido até agora:** os métodos de **escrita** (`create`/`update`) sempre convertiam corretamente com `Number(...)` nos dados de **entrada** (ex.: `buildValueData` em `prisma-properties-repository.ts`). Os métodos de **leitura** (`list()`, `findById()`) faziam apenas cast de tipo (`as Property[]`, `as unknown as Property`) sem transformação real — o TypeScript não pega isso porque a entidade `Property.values` é tipada como `unknown[]`, então não há checagem estática que capturasse a divergência. Só aparece em runtime, e só quando o dado chega de fato num Client Component.

**Corrigido** (função `serialize*` adicionada perto do topo de cada arquivo, aplicada em todo ponto de retorno de leitura E escrita — escrita também precisa porque `create`/`update` retornam o registro do Prisma após salvar):
- `prisma-properties-repository.ts`: `values`, `iptus`, `leases` (aninhado) — `list()` e `findById()`.
- `prisma-leases-repository.ts`: 11 campos do próprio `Lease` — `list()`, `findById()`, `create()`, `update()`, `softDelete()`, `permanentlyDelete()`, `restore()`, `cancelLease` (+ o `charge` retornado, que é um `Transaction`).
- `prisma-agencies-repository.ts`: `commission_percentage` — `list()` e `findById()`.
- `prisma-financial-transactions-repository.ts`: `amount` — `list()` e `findById()` (os dois pontos de maior tráfego).

**⚠️ Não é uma varredura exaustiva.** `prisma-financial-transactions-repository.ts` tem 1400+ linhas com dezenas de outros retornos (`related transactions`, agregações, invoices, etc.) que podem ter o mesmo padrão — só os dois métodos mais usados (`list`/`findById`) foram cobertos aqui, por serem os que o teste E2E de fato exercitou. Qualquer outro repositório com campos `@db.Decimal` no schema (`grep -n "@db.Decimal" prisma/schema.prisma` lista todos) que ainda não foi tocado por este achado deve ser tratado como suspeito até verificado — o padrão do bug é sempre o mesmo: procurar `as EntityType[]`/`as unknown as EntityType` em métodos de leitura e conferir se os campos Decimal do model passam por `Number(...)` antes do cast.

**Verificação:** script Playwright instrumentando `console.error` do browser para capturar o objeto ofensor completo (não só a mensagem truncada) — reduziu de 143 ocorrências capturadas por navegação para 0, confirmado em 3 execuções consecutivas sem falha.

### O que foi testado com sucesso (login real, banco/MinIO reais)

Login (`teste2@gmail.com`, empresa `teste-financeiro`), listagem + criação de Tipo de Imóvel (ponta a ponta, registro confirmado na listagem depois), form de cadastro de Proprietário (exige `?tipo=fisica|juridica` — comportamento correto, não bug), Configurações, Grupos de Usuário (Módulo 13), Auditoria (Módulo 13, após fix do `limit`), form de cadastro de Imóvel completo (todos os campos + dropdowns customizados carregando dados reais do banco — proprietário, tipo, etc.).

### Achado 3 (menor, documentado mas não corrigido) — race condition intermitente em hard-navigation

Em ~30-60% das navegações via **hard reload/goto direto** (não clique em link) para uma página client-side logo após o login, o SSR falha com `Error: useAuth must be used within an AuthProvider` (500), sempre se auto-recupera no reload seguinte. **Não reproduz em navegação client-side normal** (clique em link dentro do dashboard — 4/4 tentativas OK), que é como usuários reais navegam na prática. Tem a assinatura de uma race condition do Fast Refresh do Turbopack em dev mode, não necessariamente presente em build de produção — não investigado a fundo nem corrigido, registrado aqui para não perder o achado.

Não desligar `api-nairim-v2` até **todos** os módulos migrados, testados e aprovados. Quando `grep -rn "NEXT_PUBLIC_URL_API" src` não retornar mais nenhum uso de chamada HTTP (só imports/comentários), o Express pode ser desativado.

**Status em 2026-08-13:** o critério de código está satisfeito — `grep -rn "NEXT_PUBLIC_URL_API" src` só retorna comentários/infra deliberada (ver §1, §4.5). **Isso NÃO significa que já é seguro desligar.** Falta:
1. A validação end-to-end contra Postgres real, nunca feita para nenhum módulo (§4) — o código compilar e passar lint não prova que os fluxos funcionam de ponta a ponta contra dados reais, especialmente upload de imóveis/branding (reescritos nesta rodada) e o guard de permissão do Módulo 13 (ADMIN sem grupo vs. com grupo restrito vs. SUPER_ADMIN).
2. Decidir o destino de `/api/lead` (§1/§3) antes, para não desligar o Express e descobrir depois que a vitrine pública dependia dele de um jeito não mapeado.
3. Resolver ou pelo menos avaliar o risco do bug de hook condicional em `DataTable/index.tsx` (§3) — ele afeta a listagem usada por praticamente todos os módulos.

---

## 6. Mapa de arquivos-chave já criados (para reuso)

```
src/core/errors/domain-errors.ts            # DomainError + subclasses (status HTTP)
src/core/cryptography/{hasher,token-signer}.ts
src/core/storage/storage.ts                 # interface Storage + UploadInput
src/core/entities/*                          # user, user-preferences, company
src/core/repositories/*                      # users (segregada), companies, user-preferences
src/core/use-cases/{auth,company,user,user-preferences}/*
src/infra/config/env.ts
src/infra/database/{prisma,tenant-context}.ts
src/infra/auth/{jwt-service,bcrypt-hasher,session}.ts   # session = cookie SSR + withTenant
src/infra/storage/minio-storage.ts
src/infra/security/login-rate-limiter.ts
src/infra/repositories/prisma-*-repository.ts
src/infra/factories/{auth,company,user}-factory.ts      # composition root (DI)
src/shared/actions/action-result.ts         # ActionResult + runAction + actionFail
src/shared/validation/parse.ts
src/shared/validators/{auth,company,user,user-preferences}.ts
src/server/actions/{auth,company,user,user-preferences,lease}.ts
src/server/queries/{company,user,user-preferences,lease}.ts
src/core/use-cases/lease/{crud,cancellation,documents}.ts
src/core/repositories/{leases-repository,lease-finance-repository}.ts
src/infra/repositories/prisma-lease-finance-repository.ts  # geração idempotente de lançamentos (aluguel/comissão/IPTU)

# Módulo 13 (2026-08-12)
src/shared/utils/menu-resources.ts                          # catálogo estático de recursos/ações (porte de lib/menuResources.ts)
src/core/repositories/user-group-permissions-repository.ts
src/infra/repositories/prisma-user-group-permissions-repository.ts  # resolveForUser + cache Map/TTL 60s
src/infra/auth/session.ts                                   # withPermission(resource, action, fn) — irmã de withTenant
src/core/entities/{audit-log,iptu-audit,financial-report,user-group,user-group-permission}.ts
src/core/use-cases/{audit-log,permission,iptu-audit,financial-report,user-group}/*
src/infra/repositories/{prisma-audit-logs,prisma-iptu-audit,prisma-financial-reports,prisma-user-groups}-repository.ts
src/server/actions/{audit-log,permission,iptu-audit,financial-report,user-group}.ts
src/server/queries/{audit-log,permission,iptu-audit,financial-report,user-group}.ts
```
**Padrão para o próximo módulo (Financeiro):** o Módulo 9 é o maior restante — comece por `financial-institution` (mais simples, sem dependências) e vá subindo a cadeia (category → subcategory → card → center → supplier) antes de encarar `financial-transaction` (~1314 linhas no Express, o maior arquivo do backend). `prisma-lease-finance-repository.ts` já modela transações/lançamentos parcialmente — reveja antes de recriar as entidades de Transaction/Supplier do zero.

**Antes de declarar o projeto "pronto para desligar o Express" novamente:** reconferir `api-nairim-v2/src/routes/index.ts` linha a linha contra este documento — foi exatamente a falta dessa reconferência que deixou os 5 grupos do Módulo 13 invisíveis por tanto tempo (ver aviso no topo do arquivo).
