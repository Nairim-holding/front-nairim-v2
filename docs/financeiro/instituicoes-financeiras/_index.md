# Instituições financeiras

Cadastro das contas e instituições financeiras (bancos, caixas) usadas nos lançamentos, com resumo de saldos.

| Aspecto | Detalhe |
|---|---|
| Menu | Financeiro > Instituições Financeiras |
| Rota | `/dashboard/instituicoes-financeiras` |
| Permissão | recurso `financial-institutions` (ver, criar, editar, excluir) |
| Modelos Prisma | `FinancialInstitution` |
| Server | `server/actions/financial-institution.ts`, `server/queries/financial-institution.ts` |
| Domínio | `core/use-cases/financial-institution/crud.ts`, `core/entities/financial-institution.ts` |
| Infra | `infra/repositories/prisma-financial-institutions-repository.ts` |

## Arquivos desta pasta
[domain.md](domain.md) · [actions.md](actions.md) · [queries.md](queries.md) · [telas.md](telas.md) · [patterns.md](patterns.md) · [changelog.md](changelog.md)

## Para mexer neste módulo, saiba que
1. Excluir uma instituição com lançamentos relacionados é recusado (`ConflictError`). Exclusão é lógica (`deleted_at`); restaurar só funciona em registro excluído.
2. O saldo por conta (`getFinancialInstitutionBalanceSummaryAction`) alimenta o widget Saldo por Conta do Resumo e o extrato.
3. Instituição também é referenciada por locações, recorrências e investimentos.
