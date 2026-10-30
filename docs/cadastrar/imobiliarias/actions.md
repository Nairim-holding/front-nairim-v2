# Imobiliárias — Server Actions

Retornam `ActionResult<T>` (`{ ok: true, data } | { ok: false, error, status }`) via `runAction`.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `createAgencyAction(input: Record<string, unknown>)` | Agency | agencies:create | createAgencySchema |  |
| `updateAgencyAction(id: string, input: Record<string, unknown>)` | Agency | agencies:edit | updateAgencySchema |  |
| `deleteAgencyAction(id: string)` | { legal_name: string } | agencies:delete | — |  |
| `restoreAgencyAction(id: string)` | { legal_name: string } | agencies:edit | — |  |
| `listAgenciesAction(raw: Record<string, unknown>)` | PaginatedAgencies | herdada da query | — |  |
| `getAgencyByIdAction(id: string)` | Agency | herdada da query | — |  |
| `getAgencyFiltersAction(raw: Record<string, unknown>)` | Record<string, unknown> | herdada da query | — |  |
| `getAgencyContactSuggestionsAction(search: string)` | ContactSuggestion[] | herdada da query | — |  |
