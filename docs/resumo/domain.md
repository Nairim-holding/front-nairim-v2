# Resumo — Domínio

Fontes: `src/core/entities/dashboard.ts`, `src/core/use-cases/dashboard/crud.ts`, `src/core/utils/dashboard-metrics.ts`, `src/infra/repositories/prisma-dashboard-repository.ts`.

## Seções
`DashboardSection = 'financial' | 'portfolio' | 'clients' | 'map'`. Cada uma tem um use-case: `GetFinancialMetricsUseCase`, `GetPortfolioMetricsUseCase`, `GetClientsMetricsUseCase`, `GetGeolocationUseCase` (todos herdam `GetDashboardMetricsUseCase`, que valida o período).

## Tipos principais
- `MetricResult { result, variation, isPositive, data[] }`: valor do período, variação contra o período anterior e detalhes para a janela "ver dados".
- `ChartData { name, value, data[] }`: agrupamento para gráficos de rosca/barras.
- `FinancialMetrics`: `averageRentalTicket`, `totalRentalActive`, `totalPropertyTaxAndCondoFee` (usados na tela); `totalAcquisitionValue`, `financialVacancyRate`, `vacancyInMonths` continuam calculados, mas foram retirados da aba Financeiro.
- `PortfolioMetrics`: `totalPropertys`, `countPropertiesWithLessThan3Docs`, `totalPropertiesWithSaleValue`, `propertiesByStatus`, `propertiesByType`, `availablePropertiesByType`, `vacancyRate`, `occupationRate`, `physicalVacancy`.
- `ClientsMetrics`: `ownersTotal`, `tenantsTotal`, `propertiesPerOwner`, `agenciesTotal`, `propertiesByAgency`.
- `GeolocationPoint { lat, lng, info, propertyId, confirmed, isLeased, status }`.

## Regras de negócio
- **Período**: `startDate` e `endDate` obrigatórios no formato `YYYY-MM-DD`, início ≤ fim, intervalo máximo de **5480 dias (15 anos)**. O período anterior, para a variação, é calculado por `getPeriodDatesIn`.
- **Variação** (`calcVariation`): limitada a ±100%, `result` e `variation` com 2 casas; `isPositive` = variação ≥ 0 (ou valor atual ≥ 0 se não houver base anterior).
- **Financeiro (cards)**:
  - Considera imóveis cadastrados até o fim do período (inclui os anteriores ao mês selecionado) e não excluídos.
  - Aluguel: lançamentos de aluguel `COMPLETED`, sem transferência, sem comissão, IPTU ou multa (mesmo conceito de receita bruta do Relatório de Locações). Imóveis ocupados e disponíveis entram; vendidos não. Cada imóvel conta uma vez no divisor, mesmo com mais de um contrato.
  - Impostos e taxas: `property_tax + condo_fee` do valor mais recente do imóvel (`PropertyValue`).
  - Lançamentos considerados por `effective_date` (regime de caixa do card).
- **Portfólio**: imóveis com `created_at` dentro do período; status vem do `PropertyValue` mais recente (`AVAILABLE`, `OCCUPIED`, `SOLD`). Taxa de ocupação e vacância usam imóveis não vendidos como base. Documentação pendente = imóvel sem anexo ativo de matrícula, registro ou escritura (`TITLE_DEED`, `REGISTRATION`, `PROPERTY_RECORD`); fotos e outros documentos não valem.
- **Disponibilidade**: antes de calcular, imóveis com contrato vencido são liberados (`releaseExpiredProperties`), exceto em consolidação de várias empresas.
- **Clientes**: `propertiesPerOwner` estima o período anterior proporcional ao número de proprietários; imóveis sem agência ficam em "Sem imóvel vinculado" no agrupamento por imobiliária.
- **Mapa**: status por `getPropertyMapStatus` (`src/core/entities/property-map.ts`): `SOLD` prevalece; com contrato ou `OCCUPIED` → `OCCUPIED`; senão `AVAILABLE`. Contratos cancelados não contam como locação. Pontos têm flag `confirmed` (localização confirmada pelo usuário).

## Erros (`ValidationError`)
| Mensagem | Quando |
|---|---|
| `startDate/endDate é obrigatório` | data ausente |
| `... deve ser uma data válida no formato YYYY-MM-DD` | formato ou data inválida |
| `startDate não pode ser maior que endDate` | intervalo invertido |
| `O intervalo máximo permitido é de 15 anos` | mais de 5480 dias |
| 403 (`ForbiddenError`) | sem `dashboard:view`; a tela mostra aviso sem botão de tentar de novo |
