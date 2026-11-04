# Resumo — Server Actions

O Resumo não grava dados de negócio; as actions são leituras expostas a Client Components (retornam `ActionResult<T>`) e duas gravam preferências do usuário.

## Seções
| Action | Arquivo | Efeito |
|---|---|---|
| `getDashboardSectionAction(section, startDate?, endDate?, companyIds?)` | `server/actions/dashboard.ts` | Busca uma aba (`financial`, `portfolio`, `clients`, `map`); permissão `dashboard:view` na query |

## Widgets (cada um chama a action do seu módulo)
| Action | Arquivo | Usada em |
|---|---|---|
| `getCenterSummaryAction(raw)` | `actions/center-summary.ts` (`financial-transactions:view`, `reportParamsSchema`) | Receitas e Despesas por Centro |
| `getExpenseByCategoryAction` | `actions/financial-transaction.ts` | % por Categoria de Gasto |
| `getSubcategoryBreakdownAction`, `getReportingCategoriesAction` | `actions/financial-transaction.ts`, `reporting-options.ts` | Detalhamento por Subcategorias |
| `getMonthlySummaryAction`, `getMonthlySummaryMultiAction`, `getAvailableYearsAction` | `actions/financial-transaction.ts`, chamadas pelos hooks `useMonthlySummary`, `useMonthlySummaryMulti`, `useAvailableYears` | Receitas e Despesas, % Despesas, Receitas vs Despesas por Ano, totais do cabeçalho |
| `getPlanningDashboardAction` | `actions/planning.ts` | Realizado vs Planejado, Resumo das Receitas/Despesas |
| `getCardUsageSummaryAction` | `actions/financial-card.ts` | Gastos com Cartões de Crédito |
| `getFinancialInstitutionBalanceSummaryAction` | `actions/financial-institution.ts` | Saldo por Conta |
| `getDemonstrativoReportAction` | `actions/financial-report.ts` (`financial-reports:view`) | Demonstrativo Financeiro (reaproveita `DemonstrativoView` de Financeiro > Relatórios) |
| `getTransactionFiltersAction` | `actions/financial-transaction.ts` | Opções do filtro avançado da aba Financeiro |
| `getDatabaseUsageAction`, `getStorageUsageAction`, `getTenantTenureDistributionAction` | `actions/dashboard-usage.ts` (`dashboard:view`) | Consumo de Banco, Consumo de Anexos, Tempo de Locação |

## Preferências do usuário
| Action | Arquivo | Efeito |
|---|---|---|
| `getColumnPreferencesAction(resource)` / `saveColumnPreferencesAction(input)` | `actions/user-preferences.ts` | Quais gráficos aparecem; `resource = dashboard-widgets-<aba>`; guarda em `UserColumnPreference.visible_columns` |
| `getDashboardLayoutAction(resource)` / `saveDashboardLayoutAction(input)` | `actions/user-preferences.ts` | Posição e tamanho dos cards (`UserDashboardLayout`) |

## Padrão
Ver [patterns.md](patterns.md). Erros chegam como `{ ok: false, error, status }`; `fetchSection` converte em `Error` com `status` para a tela distinguir 403 de falha real.
