# Relatórios de locações — Domínio

## Modelos Prisma (`prisma/schema.prisma`)
_Sem modelo próprio._

## Entidades e tipos (`src/core/entities`)
`ReferenceMonth`, `LeaseReportParams`, `LeaseReportRow`, `WITHHOLDING_RATES`, `WithholdingTax`, `WITHHOLDING_TOTAL_RATE`, `MONTHLY_DARF_RATES`, `PRESUMED_PROFIT_RATE`, `QUARTERLY_DARF_RATES`, `INVESTMENT_REDEMPTION_RATES`, `WithholdingSummary`, `MonthlyDarfRow`, `Quarter`, `QuarterlyDarfRow`, `InvestmentRedemptionInput`, `InvestmentRedemptionRow`, `LeaseReportResult`, `buildRedemptionRows`, `round2`, `quartersOf`, `monthsOfQuarter`, `computeNetAmount`, `computeRedemptionPayable`, `normalizeReportText`, `ReportLeaseMatch`, `matchReportLease`

## Validação (Zod, `src/shared/validators`)
- leaseReportParamsSchema: months — lease-report.ts

## Regras de negócio
- Uma linha por contrato e competência do evento financeiro, inclusive pagamentos de vários meses recebidos juntos; a seleção de apuração e os quadros fiscais seguem o mês do recebimento.
- **Condomínio (Receita)** vem de lançamentos de receita; sem eles, usa o condomínio da locação uma vez por competência com aluguel recebido. Despesas de condomínio ficam fora. O condomínio compõe o líquido e tem total próprio.
- Ordem personalizada anterior por contrato continua válida; novas ordens usam contrato/competência.
- **Relatório de atrasos** (`/dashboard/locacoes/relatorios/atrasadas`): repasses pendentes vencidos antes da data limite, inclusive contratos encerrados; imobiliária, imóvel, competência, contrato, locatário, vencimento, dias e valor; total e Excel/PDF/impressão; pendências sem vínculo inequívoco viram aviso.
- Receita bruta usada também pelo Resumo: aluguel `COMPLETED`, sem comissão, IPTU ou multa (`classifyLeaseReportTransaction`).
- Seletor de empresas só para `SUPER_ADMIN`; leituras em lote para vários meses.
