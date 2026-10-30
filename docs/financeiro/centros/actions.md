# Centros — Server Actions

Retornam `ActionResult<T>` (`{ ok: true, data } | { ok: false, error, status }`) via `runAction`.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `createFinancialCenterAction(input: Record<string, unknown>)` | Center | financial-centers:create | createFinancialCenterSchema |  |
| `updateFinancialCenterAction(id: string, input: Record<string, unknown>)` | Center | financial-centers:edit | updateFinancialCenterSchema |  |
| `deleteFinancialCenterAction(id: string)` | null | financial-centers:delete | — |  |
| `restoreFinancialCenterAction(id: string)` | Center | financial-centers:edit | — |  |
| `quickCreateFinancialCenterAction(input: Record<string, unknown>)` | Center | financial-centers:create | quickCreateFinancialCenterSchema |  |
| `listCentersAction(raw: Record<string, unknown>)` | PaginatedCenters | herdada da query | — |  |
| `getCenterByIdAction(id: string)` | Center | herdada da query | — |  |
| `getCenterFiltersAction(raw: Record<string, unknown>)` | Record<string, unknown> | herdada da query | — |  |
| `getCenterSummaryAction(raw: Record<string, unknown>)` | — | financial-transactions:view | reportParamsSchema |  |
| `previewFinancialCentersImportAction(form: FormData)` | — | financial-centers:create | — |  |
| `importFinancialCentersAction(form: FormData)` | — | financial-centers:create | — |  |
