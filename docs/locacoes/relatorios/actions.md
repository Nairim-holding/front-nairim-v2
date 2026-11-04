# Relatórios de locações — Server Actions

Retornam `ActionResult<T>` (`{ ok: true, data } | { ok: false, error, status }`) via `runAction`.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `getLeaseReportAction(raw: Record<string, unknown>)` | LeaseReportResult | herdada da query | — |  |
| `getOverdueLeaseReportAction(raw: Record<string, unknown>)` | — | herdada da query | — |  |
