# Relatórios financeiros — Domínio

## Modelos Prisma (`prisma/schema.prisma`)
_Sem modelo próprio._

## Entidades e tipos (`src/core/entities`)
`ReportRegime`, `financialDateField`, `ReportGroupBy`, `DfcGroupBy`, `ReportStatus`, `ReportType`, `ReportParams`, `ReportItem`, `ReportGroup`, `GroupedReportResult`, `ExtratoItem`, `ReportSummary`, `ExtratoResult`, `IncomeExpenseSide`, `IncomeExpenseResult`, `DfcLineKind`, `DfcLine`, `DemonstrativoResult`, `FinancialChartDetailQuery`, `FinancialChartDetailRow`, `FinancialChartDetailsRepository`

## Validação (Zod, `src/shared/validators`)
- reportParamsSchema — financial-report.ts
- groupBySchema — financial-report.ts
- dfcGroupBySchema — financial-report.ts
- monthlySummaryQuerySchema — financial-reports.ts
- monthlySummaryMultiQuerySchema — financial-reports.ts
- financialChartDetailQuerySchema: source, regime, startDate?, endDate?, type?, centerIds?, status?, categoryId?, subcategoryId?, cardId?, institutionId?, net? — financial-reports.ts
- expenseByCategoryQuerySchema — financial-reports.ts
- subcategoryBreakdownQuerySchema — financial-reports.ts

## Regras de negócio
- Parâmetros: regime (`caixa`/`competencia`), status, tipo, agrupamento (`groupBy`, `dfcGroupBy`) e período; vale para o Resumo (widget Demonstrativo reaproveita `DemonstrativoView`).
- **Extrato**: saldos positivos em verde e negativos em vermelho; opção **Formato bancário** (Data, Descrição, Crédito, Débito, Saldo) preserva a ordem do servidor e não reordena por título de coluna; a pesquisa restringe linhas, mas saldos e totais seguem o período.
- Receitas e Despesas usa verde/vermelho, inclusive no analítico; totais aparecem uma vez no fim; valores monetários na mesma linha, com o sinal.
- Demonstrativo colore subtotais e a linha de Resultado (Lucro ou Prejuízo); Analítico abre linhas, grupos e lançamentos expandidos. Grupos DFC vêm da classificação das categorias.
- Impressão e PDF: UTF-8 com normalização Unicode, cabeçalho escapado, "Página N/total" (contadores `@page` em Chromium).
- Seletor de empresas para `SUPER_ADMIN` consolida leituras; escritas ficam na empresa da sessão.
