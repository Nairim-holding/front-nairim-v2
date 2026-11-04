# ROI por imóvel — Queries

Leituras no servidor (`'server-only'`), protegidas por `withPermission`/`withTenant`; o `company_id` entra automaticamente pela extensão Prisma.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `getRoiSettingsData()` | RoiSettingsView | financial-audit:view | — |  |
| `getRoiReportData(raw: Record<string, unknown>)` | RoiReport | financial-audit:view | roiReportQuerySchema |  |
| `getRoiOriginData(raw: Record<string, unknown>)` | RoiOrigin | financial-audit:view | roiOriginQuerySchema |  |
