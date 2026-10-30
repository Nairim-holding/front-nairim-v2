# Resumo — Queries

Leituras no servidor (`'server-only'`), todas dentro de `withPermission`, isoladas por empresa pela extensão Prisma (ou pelo contexto de consolidação para `SUPER_ADMIN`).

| Query | Arquivo | Retorno / Permissão |
|---|---|---|
| `getDashboardSectionData(section, raw)` | `server/queries/dashboard.ts` | `FinancialMetrics \| PortfolioMetrics \| ClientsMetrics \| GeolocationResponse`; `dashboard:view`; valida `startDate/endDate` |
| `getTenantTenureDistributionData(start, end, raw)` | `queries/dashboard-usage.ts` | `TenantTenureDistribution` (faixas de tempo de locação); `dashboard:view` |
| `getDatabaseUsageData(raw)` | `queries/dashboard-usage.ts` | `DatabaseUsageResult` por empresa; `dashboard:view`. Cota vem de `Company.db_quota_mb`; nulo = sem limite |
| `getStorageUsageData(raw)` | `queries/dashboard-usage.ts` | `StorageUsageResult` (anexos no MinIO por grupo); `dashboard:view` |
| `getMonthlySummaryData`, `getMonthlySummaryMultiData`, `getAvailableYearsData` | `queries/financial-reports.ts` | Totais mensais por ano (regime caixa/competência); `financial-transactions:view` |
| `getExpenseByCategoryData`, `getSubcategoryBreakdownData`, `getFinancialChartDetailsData` | `queries/financial-reports.ts` | Despesa por categoria/subcategoria e linhas do detalhamento; `financial-transactions:view` |
| `getCreditCardDashboardData(input)` | `queries/credit-card-dashboard.ts` | Painel de cartões; `financial-cards:view` |
| `getDashboardLayoutData(resource)`, `getColumnPreferencesData(resource)` | `queries/user-preferences.ts` | Preferências do usuário logado (`withTenant`) |

Observações:
- Totais mensais, despesas por categoria e anos disponíveis usam agregação no banco; o custo não cresce por empresa na consolidação.
- A coleta de métricas de portfólio busca todos os imóveis e agrega em memória (`prisma-dashboard-repository.ts`).
