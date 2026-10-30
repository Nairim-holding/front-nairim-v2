# ROI por imóvel — Domínio

## Modelos Prisma (`prisma/schema.prisma`)
### RoiSettings
- Campos: lines: Json
- Relações: company → Company
- Padrão: id, company_id, created_at, updated_at

## Entidades e tipos (`src/core/entities`)
`ROI_LINE_KEYS`, `RoiLineKey`, `RoiLineSetting`, `RoiLines`, `RoiLineDefinition`, `ROI_LINE_DEFINITIONS`, `emptyRoiLines`, `RoiCategoryOption`, `suggestRoiLines`, `normalizeRoiLines`, `missingRoiLines`, `referencePeriodMonths`, `RoiLeasePeriod`, `leasedMonths`, `RoiDatedAmount`, `maintenanceCutoffDate`, `splitMaintenance`, `RoiPropertyInput`, `RoiPropertyResult`, `computePropertyRoiUnrounded`, `computePropertyRoi`, `SaleScenarioInput`, `SaleScenarioResult`, `computeSaleScenario`, `RoiWarning`, `ROI_WARNING_LABELS`, `RoiPropertyRow`, `RoiReport`, `RoiSettingsView`, `ROI_METRIC_KEYS`

## Validação (Zod, `src/shared/validators`)
- roiSettingsSchema: lines? — property-roi.ts
- roiReportQuerySchema: from, to, propertyIds, metric — property-roi.ts
- roiOriginQuerySchema: from, to, propertyIds, metric — property-roi.ts

## Regras de negócio
- Recurso de permissão `financial-audit`. Configuração por empresa em `RoiSettings` (categorias, subcategorias e centros considerados; opções **Não considerar** e **Todas as subcategorias**).
- Investimento inicial e aluguéis usam todo o histórico; despesas periódicas usam o período e são convertidas para 12 meses; reforma inicial vs manutenção periódica separadas pelo limite inclusivo de um ano após a compra.
- Indicadores da carteira vêm das somas do rodapé, não de média dos imóveis. O aluguel mensal não tem total.
- Condomínio mensal gerado não é somado como aluguel. Centros usados por mais de um imóvel não são atribuídos a um imóvel só.
- Cenário de valorização: valor de compra editável por imóvel só na simulação; nada é salvo; ao sair da aba restaura o cadastro.
- Origem dos valores (`getRoiOriginAction`): tipos em `core/entities/property-roi-origin.ts`; detalhes em [origem-dos-valores.md](origem-dos-valores.md).
- A migration `20261013010000_property_roi` recria `RoiSettings` (removida em 18/08 e reimplementada em 13/10).
