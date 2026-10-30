# Inquilinos — Server Actions

Retornam `ActionResult<T>` (`{ ok: true, data } | { ok: false, error, status }`) via `runAction`.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `createTenantAction(input: Record<string, unknown>)` | Tenant | tenants:create | createTenantSchema |  |
| `updateTenantAction(id: string, input: Record<string, unknown>)` | Tenant | tenants:edit | updateTenantSchema |  |
| `deleteTenantAction(id: string)` | { name: string } | tenants:delete | — |  |
| `restoreTenantAction(id: string)` | Tenant | tenants:edit | — |  |
| `listTenantsAction(raw: Record<string, unknown>)` | PaginatedTenants | herdada da query | — |  |
| `getTenantByIdAction(id: string)` | Tenant | herdada da query | — |  |
| `getTenantFiltersAction(raw: Record<string, unknown>)` | Record<string, unknown> | herdada da query | — |  |
| `getTenantContactSuggestionsAction(search: string)` | ContactSuggestion[] | herdada da query | — |  |
| `getNextTenantInternalCodeAction()` | { next_internal_code: string } | herdada da query | — |  |
