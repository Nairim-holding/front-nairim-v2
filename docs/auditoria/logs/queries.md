# Logs de auditoria — Queries

Leituras no servidor (`'server-only'`), protegidas por `withPermission`/`withTenant`; o `company_id` entra automaticamente pela extensão Prisma.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `listAuditLogsData(raw: Record<string, unknown>)` | PaginatedAuditLogs | audit-logs:view | listAuditLogsQuerySchema |  |
| `getAuditLogByIdData(id: string)` | AuditLogDetail | audit-logs:view | — |  |
| `getAuditLogFiltersData(raw: Record<string, unknown>)` | AuditFiltersResponse | audit-logs:view | — |  |
