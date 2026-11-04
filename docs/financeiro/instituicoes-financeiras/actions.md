# Instituições financeiras — Server Actions

Retornam `ActionResult<T>` (`{ ok: true, data } | { ok: false, error, status }`) via `runAction`.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `createFinancialInstitutionAction(input: Record<string, unknown>)` | FinancialInstitution | financial-institutions:create | createFinancialInstitutionSchema |  |
| `updateFinancialInstitutionAction(id: string, input: Record<string, unknown>)` | FinancialInstitution | financial-institutions:edit | updateFinancialInstitutionSchema |  |
| `deleteFinancialInstitutionAction(id: string)` | null | financial-institutions:delete | — |  |
| `restoreFinancialInstitutionAction(id: string)` | FinancialInstitution | financial-institutions:edit | — |  |
| `quickCreateFinancialInstitutionAction(input: Record<string, unknown>)` | FinancialInstitution | financial-institutions:create | quickCreateFinancialInstitutionSchema |  |
| `listFinancialInstitutionsAction(raw: Record<string, unknown>)` | PaginatedFinancialInstitutions | herdada da query | — |  |
| `getFinancialInstitutionByIdAction(id: string)` | FinancialInstitution | herdada da query | — |  |
| `getFinancialInstitutionFiltersAction()` | Record<string, unknown> | herdada da query | — |  |
| `getFinancialInstitutionBalanceSummaryAction(raw: Record<string, unknown> = {})` | BalanceSummaryItem[] | herdada da query | — |  |
