# Proprietários — Server Actions

Retornam `ActionResult<T>` (`{ ok: true, data } | { ok: false, error, status }`) via `runAction`.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `createOwnerAction(input: Record<string, unknown>)` | Owner | owners:create | createOwnerSchema |  |
| `updateOwnerAction(id: string, input: Record<string, unknown>)` | Owner | owners:edit | updateOwnerSchema |  |
| `deleteOwnerAction(id: string)` | { name: string } | owners:delete | — |  |
| `restoreOwnerAction(id: string)` | Owner | owners:edit | — |  |
| `listOwnersAction(raw: Record<string, unknown>)` | PaginatedOwners | herdada da query | — |  |
| `getOwnerByIdAction(id: string)` | Owner | herdada da query | — |  |
| `getOwnerFiltersAction(raw: Record<string, unknown>)` | Record<string, unknown> | herdada da query | — |  |
| `getOwnerContactSuggestionsAction(search: string)` | ContactSuggestion[] | herdada da query | — |  |
