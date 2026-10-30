# Resumo — Filtros

## Período (`useSectionPeriod`, `components/dashboard/PeriodFilter`)
- Ano(s) e mês(es) com múltipla seleção; `getPeriodRange(years, months)` (`src/utils/periodRange.ts`) converte em `startDate`/`endDate`.
- **Limpar** usa `CLEARED_PERIOD_START` até hoje (todo o histórico). O Portfólio já abre limpo.
- Cada aba tem o seu período; mudar rebusca só a aba ativa (`onSectionRangeChange`).
- O rótulo exibido é gerado por `formatPeriodLabel` (ex.: "Outubro de 2026", "Ano inteiro de 2026").

## Regime (só aba Financeiro)
Seletor **Regime** no cabeçalho: `caixa` (usa `effective_date`, padrão) ou `competencia` (usa `event_date`). Definido em `core/entities/financial-report.ts` (`ReportRegime`, `financialDateField`). Vale para os totais do cabeçalho e para todos os gráficos da aba.

## Filtro avançado (só aba Financeiro)
Botão de funil abre `DynamicFilterModal` ("Resumo Financeiro", 3 colunas). As opções vêm de `getTransactionFiltersAction`, e o número de filtros ativos aparece no ícone. Os valores aplicados entram em `chartFilters` junto com regime e empresas. Mudar a seleção de empresas zera o filtro.

## Empresas (`ReportingCompanyFilter`)
Versão completa, com publicação e verificação, em [consolidacao-de-empresas.md](consolidacao-de-empresas.md).

Aparece só para `SUPER_ADMIN`. **Atual** = empresa da sessão. É possível marcar outras empresas ativas e aplicar em **Concluir**; vale para a página aberta e **não** troca a empresa autenticada.
- O servidor valida o papel root e a disponibilidade de todas as empresas antes de abrir o contexto de leitura (`infra/database/reporting-context.ts`, `infra/auth/reporting-scope.ts`).
- Categorias equivalentes são consolidadas por nome e tipo; subcategorias também pelo nome e tipo da categoria pai; tipos de imóvel pela descrição (normalização Unicode, espaços e caixa, preservando acentos). Cadastros originais não são copiados nem alterados.
- Apenas leituras são ampliadas; escritas, usuários, preferências e configurações ficam na empresa da sessão.
- Contratos com o mesmo número em empresas diferentes só se associam dentro da empresa do lançamento.
- Índices parciais por empresa e período: migration `20261006010000_reporting_indexes`.
