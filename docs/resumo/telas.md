# Resumo — Telas

## Rota
`/dashboard` (`src/app/dashboard/page.tsx`, Server Component). Lê `?startDate&endDate` (padrão: mês corrente, `getDefaultDateRange`), pré-carrega **só a aba Financeiro** e entrega ao `DashboardContent` (`components/domain/dashboard/DashboardClient`). Se o pré-carregamento falhar, a aba busca de novo no cliente.

## Estrutura de componentes
```
page.tsx → DashboardClient (ReportingCompaniesProvider)
  └─ DashboardLayout (src/layout/DashboardLayout/index.tsx)
       ├─ DashboardFilter        título da aba + seletor de Empresas + 4 botões de aba
       └─ Seção ativa (src/layout/DashboardLayout/sections/index.tsx)
            ├─ FinancialSection → FinancialDashboardHeader + FinancialDashboardGrid
            ├─ PortfolioSection → PeriodFilterHeader      + PortfolioDashboardGrid
            ├─ ClientsSection   → PeriodFilterHeader      + ClientsDashboardGrid
            └─ MapSection       → InteractiveMap (Leaflet, só no cliente)
```

## Cabeçalho (`components/filters/DashboardFilter`)
- Título muda por aba: **Painel Financeiro**, **Imóveis**, **Proprietários**, **Localização dos Imóveis**.
- Seletor **Empresas: Atual** (`ReportingCompanyFilter`), visível só para `SUPER_ADMIN`; ver [filtros.md](filtros.md).
- Quatro botões de ícone, na ordem: Financeiro (`$`), Portfólio (casa), Clientes (pessoa), Mapa (globo). A aba ativa fica com gradiente roxo.

## Abas
| Aba | Controles acima dos cards | Período padrão |
|---|---|---|
| Financeiro | Filtro avançado, Personalizar Gráficos, período (ano e mês, múltipla seleção), regime, totais Receitas/Despesas/Resultado | ano e mês correntes |
| Portfólio | Personalizar Gráficos, período | **limpo** (desde o início até hoje) |
| Clientes | Personalizar Gráficos, período | ano e mês correntes |
| Mapa | nenhum (não escuta período) | todos os imóveis |

## Carregamento
- Troca de aba: busca a seção na primeira vez; depois usa cache da sessão da página.
- Troca de período ou de empresas: o cache é invalidado e a aba ativa é rebuscada; cada seção tem número de versão para descartar respostas atrasadas.
- Durante a busca aparecem 6 esqueletos (600 px no mapa).
- Erro 403: `ForbiddenNotice` (sem botão de tentar de novo). Outro erro: mensagem + **Tentar novamente**.

## Personalizar gráficos
- Botão `WidgetPersonalizer`: marca quais gráficos aparecem por aba. Salvo por usuário (debounce) em `UserColumnPreference` com `resource = dashboard-widgets-<financeiro-v5|imoveis-v3|clientes-v2>`. Lista vazia = mostrar todos; ids novos entram automaticamente (ex.: `widget-21` Demonstrativo).
- Posição e tamanho: os cards são arrastados e redimensionados na grade (`react-grid-layout`, 12 colunas, `DashboardWidgetGrid`); salvo por usuário em `UserDashboardLayout` (`useDashboardLayout`) com a mesma chave de recurso. Quando um widget muda de altura entre versões, a grade aceita o prop `normalizeItem` para ajustar layouts já salvos (o layout salvo vence o padrão). No celular os cards ficam empilhados.
- A barra do título do cartão é a alça de arrastar.

## Detalhes dos cards
Cada card tem ícone de dados (abre `DataModal` com a lista que originou o número) e, nos gráficos grandes, botão de expandir. O catálogo completo está em [widgets.md](widgets.md).

## Interação com outros módulos
O sino **Alertas de locações** do menu lateral não é do Resumo; ver `docs/locacoes/alertas-atrasos/`.
