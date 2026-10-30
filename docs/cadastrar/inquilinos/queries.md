# Inquilinos — Queries

Leituras no servidor (`'server-only'`), protegidas por `withPermission`/`withTenant`; o `company_id` entra automaticamente pela extensão Prisma.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `listTenantsData(raw: Record<string, unknown>)` | PaginatedTenants | tenants:view | listTenantsQuerySchema |  |
| `getTenantByIdData(id: string)` | Tenant | tenants:view | — |  |
| `getTenantFiltersData(raw: Record<string, unknown>)` | Record<string, unknown> | tenants:view | — |  |
| `getTenantContactSuggestionsData(search: string)` | ContactSuggestion[] | tenants:view | — |  |
| `getNextTenantInternalCodeData()` | string | tenants:view | — |  |
