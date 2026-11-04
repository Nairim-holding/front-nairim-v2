# Meus investimentos

Meus Investimentos: produtos de investimento, aportes, resgates e saldos mensais, com rendimento mensal calculado e grau de independência financeira.

| Aspecto | Detalhe |
|---|---|
| Menu | Financeiro > Meus Investimentos |
| Rota | `/dashboard/investimentos` |
| Permissão | recurso `investments` (ver, criar, editar, excluir) |
| Modelos Prisma | `Investment`, `InvestmentTransaction`, `InvestmentMonthBalance`, `InvestmentSettings` |
| Server | `server/actions/investment.ts`, `server/queries/investment.ts` |
| Domínio | `core/use-cases/investment/crud.ts`, `core/use-cases/investment/dashboard-math.ts`, `core/entities/investment.ts` |
| Infra | `infra/repositories/prisma-investments-repository.ts` |

## Arquivos desta pasta
[domain.md](domain.md) · [actions.md](actions.md) · [queries.md](queries.md) · [telas.md](telas.md) · [patterns.md](patterns.md) · [changelog.md](changelog.md) · [rendimento.md](rendimento.md)

## Para mexer neste módulo, saiba que
1. Liquidez: ou "apenas no vencimento" (exige vencimento) ou prazo em dias; nunca ambas nem nenhuma. Vencimento nunca antes da aplicação. Aporte e resgate novos exigem valor positivo e data ≥ aplicação. O valor investido do cadastro aceita R$ 0,00.
2. Rendimento do mês = saldo final − saldo anterior − aportes líquidos do mês. O capital inicial (valor investido) é a base; o aporte automático legado correspondente é desconsiderado em Aplicado. Detalhes e exemplo numérico em [rendimento.md](rendimento.md).
3. Cálculos puros em `core/use-cases/investment` (testados sem banco, `__tests__/dashboard-math.test.ts`); não os mova para o repositório.
4. Colunas visíveis e a ordem são personalizáveis por usuário e empresa; Excel e PDF usam as colunas visíveis.
5. Só `Investment` e `InvestmentSettings` têm `company_id`; transações e saldos mensais são escopados pelo investimento pai.
