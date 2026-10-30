# Planejamento e controle — Domínio

## Modelos Prisma (`prisma/schema.prisma`)
### Planning
- Campos: category_id: String; subcategory_id: String?; type: PlanningType; default_amount: Decimal?; min_recommended: Decimal?; max_recommended: Decimal?; is_active: Boolean
- Relações: category → Category; subcategory → Subcategory; monthly_values[] → PlanningMonth; company → Company
- Padrão: id, company_id, created_at, updated_at, deleted_at (exclusão lógica)

### PlanningMonth
- Campos: planning_id: String; month: Int; amount: Decimal
- Relações: planning → Planning
- Únicos compostos: planning_id, month
- Padrão: id

## Entidades e tipos (`src/core/entities`)
`PlanningType`, `PlanningMonthlyValue`, `Planning`, `UpsertPlanningData`, `PlanningDashboardFilters`, `MonthlyData`, `MonthlyPlanned`, `PlanningDashboardItem`, `PlanningCategoryDashboard`, `PlanningDashboardResponse`

## Validação (Zod, `src/shared/validators`)
- planningUpsertSchema — planning.ts
- planningDashboardQuerySchema — planning.ts

## Regras de negócio
- Cada item exige categoria (`category_id`) e tipo `FIXED` ou `VARIABLE`. `FIXED` exige `default_amount`; `VARIABLE` exige `monthly_values` (mês 1–12, sem duplicados, valores não negativos).
- Datas obrigatórias no formato `YYYY-MM-DD` com início ≤ fim.
- `PlanningMonth` não tem `company_id`; o isolamento vem do `Planning` pai.
- Alimenta os widgets Realizado vs Planejado e Resumo das Receitas/Despesas do Resumo (`getPlanningDashboardAction`).

## Erros lançados nos use-cases
| Classe | Mensagem | Arquivo |
|---|---|---|
| ValidationError | category_id é obrigatório | crud.ts |
| ValidationError | type deve ser FIXED ou VARIABLE | crud.ts |
| ValidationError | default_amount é obrigatório para planejamentos do tipo FIXED | crud.ts |
| ValidationError | monthly_values é obrigatório para planejamentos do tipo VARIABLE e deve ser um array não vazio | crud.ts |
| ValidationError | monthly_values[${index}].month deve ser um número entre 1 e 12 | crud.ts |
| ValidationError | monthly_values não pode conter meses duplicados | crud.ts |
| ValidationError | monthly_values[${index}].amount deve ser um número não negativo | crud.ts |
| ValidationError | startDate deve estar no formato YYYY-MM-DD | crud.ts |
| ValidationError | endDate deve estar no formato YYYY-MM-DD | crud.ts |
| ValidationError | startDate é uma data inválida | crud.ts |
| ValidationError | endDate é uma data inválida | crud.ts |
| ValidationError | startDate não pode ser maior que endDate | crud.ts |
| ValidationError | O ID é obrigatório | crud.ts |
