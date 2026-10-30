# Planejamento e controle

Planejamento e controle: valores planejados por categoria/subcategoria (fixos ou variáveis por mês) comparados ao realizado.

| Aspecto | Detalhe |
|---|---|
| Menu | Financeiro > Planejamento e Controle |
| Rota | `/dashboard/planejamento` |
| Permissão | recurso `planning` (ver, criar, editar, excluir) |
| Modelos Prisma | `Planning`, `PlanningMonth` |
| Server | `server/actions/planning.ts`, `server/queries/planning.ts` |
| Domínio | `core/use-cases/planning/crud.ts`, `core/entities/planning.ts` |
| Infra | — |

## Arquivos desta pasta
[domain.md](domain.md) · [actions.md](actions.md) · [queries.md](queries.md) · [telas.md](telas.md) · [patterns.md](patterns.md) · [changelog.md](changelog.md)

## Para mexer neste módulo, saiba que
1. Cada item exige categoria (`category_id`) e tipo `FIXED` ou `VARIABLE`. `FIXED` exige `default_amount`; `VARIABLE` exige `monthly_values` (mês 1–12, sem duplicados, valores não negativos).
2. Datas obrigatórias no formato `YYYY-MM-DD` com início ≤ fim.
3. `PlanningMonth` não tem `company_id`; o isolamento vem do `Planning` pai.
4. Alimenta os widgets Realizado vs Planejado e Resumo das Receitas/Despesas do Resumo (`getPlanningDashboardAction`).
