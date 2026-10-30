# Relatórios de locações — Queries

Leituras no servidor (`'server-only'`), protegidas por `withPermission`/`withTenant`; o `company_id` entra automaticamente pela extensão Prisma.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `getLeaseReportData(raw: Record<string, unknown>)` | LeaseReportResult | lease-reports:view | leaseReportParamsSchema |  |
