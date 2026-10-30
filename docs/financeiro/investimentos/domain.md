# Meus investimentos — Domínio

## Modelos Prisma (`prisma/schema.prisma`)
### Investment
- Campos: financial_institution_id: String; partition: String; issuer: String; product_type: InvestmentProductType; product: String; application_date: DateTime; maturity_date: DateTime?; liquidity_days: Int?; liquidity_at_maturity: Boolean; invested_amount: Decimal; notes: String?; display_order: Int; liquidated_at: DateTime?; is_active: Boolean
- Relações: company → Company; financial_institution → FinancialInstitution; transactions[] → InvestmentTransaction; monthly_balances[] → InvestmentMonthBalance
- Padrão: id, company_id, created_at, updated_at, deleted_at (exclusão lógica)

### InvestmentTransaction
- Campos: investment_id: String; type: InvestmentTransactionType; date: DateTime; amount: Decimal
- Relações: investment → Investment
- Padrão: id, created_at, updated_at

### InvestmentMonthBalance
- Campos: investment_id: String; year: Int; month: Int; balance: Decimal
- Relações: investment → Investment
- Únicos compostos: investment_id, year, month
- Padrão: id

### InvestmentSettings
- Campos: independence_reference_amount: Decimal?
- Relações: company → Company
- Padrão: id, company_id, created_at, updated_at

## Entidades e tipos (`src/core/entities`)
`InvestmentProductType`, `InvestmentTransactionType`, `Investment`, `CreateInvestmentData`, `UpdateInvestmentData`, `InvestmentTransactionEntry`, `UpsertInvestmentTransactionData`, `InvestmentMonthCell`, `InvestmentRow`, `InvestmentSummaryRow`, `InvestmentDashboardFilters`, `InvestmentDashboardParams`, `InvestmentDashboardResponse`, `InvestmentSettings`

## Validação (Zod, `src/shared/validators`)
- investmentProductTypeSchema: financial_institution_id, partition, issuer, product_type, product, application_date, maturity_date, liquidity_days, liquidity_at_maturity?, invested_amount, notes — investment.ts
- createInvestmentSchema: financial_institution_id, partition, issuer, product_type, product, application_date, maturity_date, liquidity_days, liquidity_at_maturity?, invested_amount, notes — investment.ts
- updateInvestmentSchema: ordered_ids — investment.ts
- investmentDashboardQuerySchema: ordered_ids — investment.ts
- investmentReorderSchema: ordered_ids — investment.ts
- investmentNotesSchema: id, notes — investment.ts
- investmentTransactionSchema: investment_id, type?, date, amount — investment.ts
- investmentTransactionUpdateSchema: investment_id, year, month — investment.ts
- investmentTransactionListSchema: investment_id, year, month — investment.ts
- investmentMonthBalanceSchema: investment_id, year, month, balance? — investment.ts
- investmentSettingsSchema: independence_reference_amount — investment.ts

## Regras de negócio
- Liquidez: ou "apenas no vencimento" (exige vencimento) ou prazo em dias; nunca ambas nem nenhuma. Vencimento nunca antes da aplicação. Aporte e resgate novos exigem valor positivo e data ≥ aplicação. O valor investido do cadastro aceita R$ 0,00.
- Rendimento do mês = saldo final − saldo anterior − aportes líquidos do mês. O capital inicial (valor investido) é a base; o aporte automático legado correspondente é desconsiderado em Aplicado. Detalhes e exemplo numérico em [rendimento.md](rendimento.md).
- Cálculos puros em `core/use-cases/investment` (testados sem banco, `__tests__/dashboard-math.test.ts`); não os mova para o repositório.
- Colunas visíveis e a ordem são personalizáveis por usuário e empresa; Excel e PDF usam as colunas visíveis.
- Só `Investment` e `InvestmentSettings` têm `company_id`; transações e saldos mensais são escopados pelo investimento pai.

## Erros lançados nos use-cases
| Classe | Mensagem | Arquivo |
|---|---|---|
| ValidationError | ${field} deve ser um valor maior que zero | crud.ts |
| ValidationError | O valor investido não pode ser negativo | crud.ts |
| ValidationError | Informe o vencimento para liquidez apenas no vencimento | crud.ts |
| ValidationError | A liquidez em dias deve ser um número inteiro de dias | crud.ts |
| ValidationError | O vencimento não pode ser anterior à data da aplicação | crud.ts |
| ValidationError | O período deve estar no formato AAAA-MM | crud.ts |
| ValidationError | O mês inicial não pode ser posterior ao mês final | crud.ts |
| ValidationError | O ID é obrigatório | crud.ts |
| NotFoundError | Investimento não encontrado | crud.ts |
| ValidationError | A instituição financeira é obrigatória | crud.ts |
| ValidationError | O emissor é obrigatório | crud.ts |
| ValidationError | O produto é obrigatório | crud.ts |
| ValidationError | A data da aplicação é obrigatória | crud.ts |
| ValidationError | O emissor não pode ser vazio | crud.ts |
| ValidationError | O produto não pode ser vazio | crud.ts |
| ValidationError | Informe a nova ordem dos investimentos | crud.ts |
| ValidationError | A ordem enviada tem investimentos repetidos | crud.ts |
| ValidationError | O investimento é obrigatório | crud.ts |
| ValidationError | Mês inválido | crud.ts |
| ValidationError | O aporte não pode ser anterior à data da aplicação do investimento | crud.ts |
| ValidationError | A data é obrigatória | crud.ts |
| ValidationError | O saldo do mês deve ser um valor não negativo | crud.ts |
