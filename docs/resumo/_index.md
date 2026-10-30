# Resumo (Dashboard)

Tela inicial do sistema (`/dashboard`, ou `/<slug-da-empresa>/dashboard`). Mostra indicadores e gráficos em **quatro abas**: Financeiro, Portfólio (imóveis), Clientes e Mapa.

| Aspecto | Detalhe |
|---|---|
| Menu | Resumo |
| Rota | `/dashboard` (`src/app/dashboard/page.tsx`) |
| Permissão | recurso `dashboard`, ação `view` (as consultas dos gráficos financeiros exigem também `financial-transactions:view`, `financial-reports:view`, `financial-cards:view` conforme o widget) |
| Modelos | `Property`, `PropertyValue`, `Document`, `Lease`, `Transaction`, `Owner`, `Tenant`, `Agency`; preferências em `UserColumnPreference` e `UserDashboardLayout` |
| Entidades | `src/core/entities/dashboard.ts`, `dashboard-usage.ts`, `center-summary.ts`, `credit-card-dashboard.ts` |
| Use-case | `src/core/use-cases/dashboard/crud.ts` |
| Repositório | `src/infra/repositories/prisma-dashboard-repository.ts` |
| Server | `src/server/actions/dashboard.ts`, `src/server/queries/dashboard.ts` e as actions de cada widget |
| Telas | `src/components/domain/dashboard/DashboardClient`, `src/layout/DashboardLayout`, `src/components/dashboard/*` |

## Arquivos desta pasta
- [domain.md](domain.md) — métricas, regras de cálculo e erros
- [actions.md](actions.md) — Server Actions usadas pela tela
- [queries.md](queries.md) — leituras no servidor
- [telas.md](telas.md) — abas, cabeçalho, carregamento e personalização
- [widgets.md](widgets.md) — catálogo de cards e gráficos (id, rótulo, fonte de dados)
- [filtros.md](filtros.md) — período, regime, empresas e filtros avançados
- [consolidacao-de-empresas.md](consolidacao-de-empresas.md) — relatórios e dashboards de várias empresas (regras, publicação e verificação)
- [patterns.md](patterns.md) — trechos reais para copiar
- [changelog.md](changelog.md) — histórico

## Para mexer neste módulo, saiba que
1. Só a aba **Financeiro** é pré-carregada no servidor; as demais são buscadas ao clicar (`fetchSection` → `getDashboardSectionAction`).
2. Cada aba é dona do seu período. Mudar o período rebusca **só aquela aba**, sem `router.push` (evita remontar a tela e perder o estado do filtro).
3. Todo gráfico novo precisa de um id em `WIDGET_LABELS`/`ALL_WIDGET_IDS` da grade da aba; as preferências salvas dos usuários são por id.
4. Ao mudar o tamanho padrão de um widget já existente, os layouts salvos dos usuários vencem o padrão; use o prop `normalizeItem` de `DashboardWidgetGrid` (ver [telas.md](telas.md)).
5. Intervalo de datas: obrigatório `YYYY-MM-DD`, início ≤ fim, máximo de 15 anos (5480 dias).
6. O seletor **Empresas** (consolidar várias empresas) só existe para `SUPER_ADMIN` e vale apenas para leitura da página aberta.
