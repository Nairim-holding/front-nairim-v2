# Resumo — Catálogo de widgets

Ids e rótulos vêm de `WIDGET_LABELS` em cada grade (`src/components/dashboard/<Aba>DashboardGrid/index.tsx`). A visibilidade salva por usuário é por id; **não renomeie nem reutilize ids**.

## Financeiro (`financeiro-v5`)
Todos respeitam período, regime, filtros avançados e empresas selecionadas da aba, exceto os 3 primeiros (cards de carteira), que usam o período e a métrica `financial` do servidor.

| Id | Rótulo | Componente | Fonte |
|---|---|---|---|
| widget-11 | Ticket Médio da Locação | `NumericCard` | `FinancialMetrics.averageRentalTicket` |
| widget-12 | Valor Total de Aluguel do Portfólio | `NumericCard` | `totalRentalActive` |
| widget-13 | Total de Impostos e Taxas (Mensal Est.) | `NumericCard` | `totalPropertyTaxAndCondoFee` |
| widget-1 | Receitas e Despesas | `MonthlyIncomeExpenseChart` | `getMonthlySummaryMultiAction` |
| widget-2 | % Despesas em Relação às Receitas | `ExpenseRatioChart` | `getMonthlySummaryAction` |
| widget-20 | Receitas e Despesas por Centro | `CenterIncomeExpenseChart` | `getCenterSummaryAction` |
| widget-7 | Despesas: Realizado VS Planejado | `RealizedVsPlannedChart` | `getPlanningDashboardAction` |
| widget-8 | Gastos com Cartões de Crédito | `CardUsageChart` | `getCardUsageSummaryAction` |
| widget-3 | % por Categoria de Gasto em Relação à Receita | `ExpenseByCategoryChart` | `getExpenseByCategoryAction` |
| widget-10 | Detalhamento de Gastos por Subcategorias | `SubcategoryBreakdownChart` | `getSubcategoryBreakdownAction` |
| widget-9 | Saldo por Conta | `AccountBalanceChart` | `getFinancialInstitutionBalanceSummaryAction` |
| widget-17 | Resumo das Receitas | `ResumoReceitasChart` | `getPlanningDashboardAction` (via `PlanningSubcategoryBarChart`) |
| widget-18 | Resumo das Despesas | `ResumoDespesasChart` | idem |
| widget-19 | Receitas VS Despesas por Ano | `YearlyIncomeExpenseChart` | `getMonthlySummaryMultiAction` |
| widget-21 | Demonstrativo Financeiro | `DashboardDemonstrativoWidget` | `DemonstrativoView` de Financeiro > Relatórios |

Regras:
- Receitas e despesas pela data efetiva (regime **Caixa**) ou pela data do evento (**Competência**); transferências ficam de fora; lançamentos sem centro aparecem como "Sem centro".
- O gráfico por Centro mostra o saldo (receitas − despesas) no tooltip e na tabela de dados.
- Totais Receitas/Despesas/Resultado do cabeçalho somam os meses selecionados dos anos escolhidos.
- Cada gráfico com detalhamento usa `financialChartDetails.ts` para listar os lançamentos de origem.

## Portfólio / Imóveis (`imoveis-v3`)
| Id | Rótulo | Fonte |
|---|---|---|
| widget-p1 | Total de Imóveis | `totalPropertys` |
| widget-p2 | Imóveis com Documentação Pendente | `countPropertiesWithLessThan3Docs` |
| widget-p3 | Imóveis com Valor de Venda Definido | `totalPropertiesWithSaleValue` |
| widget-p4 | Imóveis por Status de Disponibilidade | `propertiesByStatus` (Disponíveis, Ocupados, Vendidos) |
| widget-p6 | Taxa de Ocupação | `occupationRate` |
| widget-p5 | Imóveis Sem Locação | `availablePropertiesByType` |
| widget-p7 | Taxa de Vacância Física | `physicalVacancy` |
| widget-p8 | Consumo de Anexos | `getStorageUsageAction` (`StorageUsageChart`) |
| widget-p9 | Consumo de Banco de Dados | `getDatabaseUsageAction` (`DatabaseUsageChart`) |
| widget-p10 | Tempo de Locação | `getTenantTenureDistributionAction` (`TenantTenureChart`) |
| widget-p11 | Imóveis por Tipo | `propertiesByType` |

## Clientes / Proprietários (`clientes-v2`)
| Id | Rótulo | Fonte |
|---|---|---|
| widget-c2 | Total de Proprietários | `ownersTotal` |
| widget-c3 | Total de Inquilinos | `tenantsTotal` |
| widget-c4 | Média de Imóveis por Proprietário | `propertiesPerOwner` |
| widget-c5 | Total de Imobiliárias | `agenciesTotal` |
| widget-c6 | Imóveis por Imobiliárias | `propertiesByAgency` (inclui "Sem imóvel vinculado") |

## Mapa
Sem widgets. `InteractiveMap` (`components/map/InteractiveMap`, Leaflet, `ssr: false`) mostra um ponto por imóvel com coordenada, colorido por status (`OCCUPIED`, `AVAILABLE`, `SOLD`) e indica se a localização foi confirmada. Tiles CARTO com chave `NEXT_PUBLIC_CARTO_API_KEY` (fallback OpenStreetMap).

## Como adicionar um widget
1. Criar o componente em `src/components/dashboard/<Nome>/index.tsx` (ECharts via `EchartsSurface`/`ChartCard`; tooltips com `utils/echartsTooltip.ts`, que escapa texto vindo do banco).
2. Registrar id em `WIDGET_LABELS`, o componente no mapa da grade e o tamanho em `DEFAULT_LAYOUT`.
3. Se for visível por padrão para quem já salvou preferências, incluir o id em `newlyAddedWidgetIds` de `useWidgetVisibility` na seção.
