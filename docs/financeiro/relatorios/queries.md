# Relatórios financeiros — Queries

Leituras no servidor (`'server-only'`), protegidas por `withPermission`/`withTenant`; o `company_id` entra automaticamente pela extensão Prisma.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `getGroupedReportData(raw: Record<string, unknown>)` | GroupedReportResult | financial-reports:view | groupBySchema |  |
| `getExtratoReportData(raw: Record<string, unknown>)` | ExtratoResult | financial-reports:view | — |  |
| `getIncomeExpenseReportData(raw: Record<string, unknown>)` | IncomeExpenseResult | financial-reports:view | — |  |
| `getDemonstrativoReportData(raw: Record<string, unknown>)` | DemonstrativoResult | financial-reports:view | dfcGroupBySchema |  |
| `getFinancialChartDetailsData(raw: Record<string, unknown>, filters?: Record<string, unknown>,)` | FinancialChartDetailRow[] | financial-transactions:view | financialChartDetailQuerySchema |  |
| `getMonthlySummaryData(raw: Record<string, unknown>,)` | MonthlySummary | financial-transactions:view | monthlySummaryQuerySchema |  |
| `getMonthlySummaryMultiData(raw: Record<string, unknown>,)` | MonthlySummaryMultiResult | financial-transactions:view | monthlySummaryMultiQuerySchema |  |
| `getAvailableYearsData(raw: Record<string, unknown> = {})` | AvailableYearsResult | financial-transactions:view | — |  |
| `getExpenseByCategoryData(raw: Record<string, unknown>,)` | ExpenseByCategoryResult | financial-transactions:view | expenseByCategoryQuerySchema |  |
| `getSubcategoryBreakdownData(raw: Record<string, unknown>,)` | SubcategoryBreakdownResult | financial-transactions:view | subcategoryBreakdownQuerySchema |  |
| `getTransactionDocumentsData(transactionId: string)` | TransactionDocument[] | financial-transactions:view | — |  |
