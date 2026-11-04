# Meus investimentos — Server Actions

Retornam `ActionResult<T>` (`{ ok: true, data } | { ok: false, error, status }`) via `runAction`.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `createInvestmentAction(input: Record<string, unknown>,)` | Investment | investments:create | createInvestmentSchema |  |
| `updateInvestmentAction(id: string, input: Record<string, unknown>,)` | Investment | investments:edit | updateInvestmentSchema |  |
| `deleteInvestmentAction(id: string)` | null | investments:delete | — |  |
| `reorderInvestmentsAction(input: Record<string, unknown>,)` | null | investments:edit | investmentReorderSchema |  |
| `updateInvestmentNotesAction(input: Record<string, unknown>,)` | Investment | investments:edit | investmentNotesSchema |  |
| `listInvestmentTransactionsAction(input: Record<string, unknown>,)` | InvestmentTransactionEntry[] | investments:view | investmentTransactionListSchema |  |
| `createInvestmentTransactionAction(input: Record<string, unknown>,)` | InvestmentTransactionEntry | investments:create | investmentTransactionSchema |  |
| `updateInvestmentTransactionAction(id: string, input: Record<string, unknown>,)` | InvestmentTransactionEntry | investments:edit | investmentTransactionUpdateSchema |  |
| `deleteInvestmentTransactionAction(id: string)` | null | investments:delete | — |  |
| `setInvestmentMonthBalanceAction(input: Record<string, unknown>,)` | null | investments:edit | investmentMonthBalanceSchema |  |
| `saveInvestmentSettingsAction(input: Record<string, unknown>,)` | InvestmentSettings | investments:edit | investmentSettingsSchema |  |
| `getInvestmentDashboardAction(raw: Record<string, unknown>,)` | InvestmentDashboardResponse | herdada da query | — |  |
| `listInvestmentsAction()` | Investment[] | herdada da query | — |  |
| `getInvestmentFiltersAction()` | Record<string, unknown> | herdada da query | — |  |
| `getInvestmentSettingsAction()` | InvestmentSettings | herdada da query | — |  |
