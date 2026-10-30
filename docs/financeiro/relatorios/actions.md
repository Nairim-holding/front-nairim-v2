# Relatórios financeiros — Server Actions

Retornam `ActionResult<T>` (`{ ok: true, data } | { ok: false, error, status }`) via `runAction`.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `getGroupedReportAction(raw: Record<string, unknown>)` | GroupedReportResult | herdada da query | — |  |
| `getExtratoReportAction(raw: Record<string, unknown>)` | ExtratoResult | herdada da query | — |  |
| `getIncomeExpenseReportAction(raw: Record<string, unknown>)` | IncomeExpenseResult | herdada da query | — |  |
| `getDemonstrativoReportAction(raw: Record<string, unknown>)` | DemonstrativoResult | herdada da query | — |  |
| `getReportingOptionsAction(raw: Record<string, unknown> = {})` | — | financial-reports:view | — |  |
| `getReportingCategoriesAction(raw: Record<string, unknown> = {})` | — | financial-categories:view | — |  |
