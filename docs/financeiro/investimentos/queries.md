# Meus investimentos — Queries

Leituras no servidor (`'server-only'`), protegidas por `withPermission`/`withTenant`; o `company_id` entra automaticamente pela extensão Prisma.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `normalizeInvestmentFilterValues(value: unknown)` | string[] | herdada da query | — |  |
| `getInvestmentDashboardData(raw: Record<string, unknown>,)` | InvestmentDashboardResponse | investments:view | investmentDashboardQuerySchema |  |
| `listInvestmentsData()` | Investment[] | investments:view | — |  |
| `getInvestmentFiltersData()` | Record<string, unknown> | investments:view | — |  |
| `getInvestmentSettingsData()` | InvestmentSettings | investments:view | — |  |
