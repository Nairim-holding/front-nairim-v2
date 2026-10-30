# Alertas de atrasos — Queries

Leituras no servidor (`'server-only'`), protegidas por `withPermission`/`withTenant`; o `company_id` entra automaticamente pela extensão Prisma.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `resolveAgencyAlertContact(contacts: Array<{ email: string / null; cellphone: string / null; phone: string …)` | { email: string / null; phone: string / null } | herdada da query | — |  |
| `findOverdueLeasesForCompany(companyId: string)` | OverdueLease[] | herdada da query | — |  |
| `listOverdueLeasesData()` | LeaseOverdueSummary | leases:view | — |  |
| `getOverdueLeaseReportData(raw: Record<string, unknown>)` | — | lease-reports:view | — |  |
