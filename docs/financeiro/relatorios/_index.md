# Relatórios financeiros

Relatórios financeiros (Agrupado, Extrato, Receitas e Despesas, Demonstrativo/DFC) com impressão, PDF e Excel.

| Aspecto | Detalhe |
|---|---|
| Menu | Financeiro > Relatórios |
| Rota | `/dashboard/relatorios` |
| Permissão | recurso `financial-reports` (ver, criar, editar, excluir) |
| Modelos Prisma | — |
| Server | `server/actions/financial-report.ts`, `server/actions/reporting-options.ts`, `server/queries/financial-report.ts`, `server/queries/financial-reports.ts` |
| Domínio | `core/use-cases/financial-report/aggregations.ts`, `core/entities/financial-report.ts`, `core/entities/financial-chart-detail.ts` |
| Infra | `infra/repositories/prisma-financial-reports-repository.ts` |

## Arquivos desta pasta
[domain.md](domain.md) · [actions.md](actions.md) · [queries.md](queries.md) · [telas.md](telas.md) · [patterns.md](patterns.md) · [changelog.md](changelog.md)

## Para mexer neste módulo, saiba que
1. Parâmetros: regime (`caixa`/`competencia`), status, tipo, agrupamento (`groupBy`, `dfcGroupBy`) e período; vale para o Resumo (widget Demonstrativo reaproveita `DemonstrativoView`).
2. **Extrato**: saldos positivos em verde e negativos em vermelho; opção **Formato bancário** (Data, Descrição, Crédito, Débito, Saldo) preserva a ordem do servidor e não reordena por título de coluna; a pesquisa restringe linhas, mas saldos e totais seguem o período.
3. Receitas e Despesas usa verde/vermelho, inclusive no analítico; totais aparecem uma vez no fim; valores monetários na mesma linha, com o sinal.
4. Demonstrativo colore subtotais e a linha de Resultado (Lucro ou Prejuízo); Analítico abre linhas, grupos e lançamentos expandidos. Grupos DFC vêm da classificação das categorias.
5. Impressão e PDF: UTF-8 com normalização Unicode, cabeçalho escapado, "Página N/total" (contadores `@page` em Chromium).
6. Seletor de empresas para `SUPER_ADMIN` consolida leituras; escritas ficam na empresa da sessão.
