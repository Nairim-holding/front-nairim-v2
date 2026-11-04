# Relatórios de locações — Telas

## Quadros fiscais e impressão
`_components/TaxPanels.tsx` apresenta retenções, DARF mensal, aplicações e DARF trimestral. O total trimestral inclui o imposto da aplicação correspondente ao ano, trimestre e tributo. `_lib/printLayout.ts` usa o mesmo total no modelo impresso; `_lib/tax-panels.test.ts` verifica a consistência. A tabela principal mantém uma célula `no-export` separada no rodapé para não deslocar os totais quando a alça de ordenação é removida.

## `/dashboard/locacoes/relatorios/atrasadas`
Arquivo: `src/app/dashboard/(cadastro)/locacoes/relatorios/atrasadas/content.tsx` (42 linhas)
- Componentes: `layout/PageSection`, `reports/ReportingCompanies`

## `/dashboard/locacoes/relatorios`
Arquivo: `src/app/dashboard/(cadastro)/locacoes/relatorios/content.tsx` (310 linhas)
- Componentes: `layout/PageSection`, `reports/ReportingCompanies`

## `/dashboard/locacoes/relatorios` — Relatório de Locações
Arquivo: `src/app/dashboard/(cadastro)/locacoes/relatorios/page.tsx` (26 linhas)
- Componentes: `layout/PageSection`
