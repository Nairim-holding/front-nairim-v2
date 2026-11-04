# Auditoria de IPTU — Queries

Leituras no servidor (`'server-only'`), protegidas por `withPermission`/`withTenant`; o `company_id` entra automaticamente pela extensão Prisma.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `getIptuAuditSettingsData()` | IptuAuditSettings / null | financial-audit:view | — |  |
| `getIptuAuditData(raw: Record<string, unknown>)` | IptuAuditReport | financial-audit:view | iptuAuditQuerySchema |  |
