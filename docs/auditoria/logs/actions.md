# Logs de auditoria — Server Actions

Retornam `ActionResult<T>` (`{ ok: true, data } | { ok: false, error, status }`) via `runAction`.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `listAuditLogsAction(raw: Record<string, unknown>)` | PaginatedAuditLogs | herdada da query | — |  |
| `getAuditLogByIdAction(id: string)` | AuditLogDetail | herdada da query | — |  |
| `getAuditLogFiltersAction(raw: Record<string, unknown>)` | AuditFiltersResponse | herdada da query | — |  |
| `auditPreparedExportAction(input: z.input<typeof schema>)` | — | herdada da query | — | Records a prepared browser export; no downloaded file data is accepted. |
