# Logs de auditoria — Padrões de código

## Server Action (`src/server/actions/audit-log.ts`)
```ts
export async function listAuditLogsAction(raw: Record<string, unknown>): Promise<ActionResult<PaginatedAuditLogs>> {
  return runAction(() => listAuditLogsData(raw));
}
```
