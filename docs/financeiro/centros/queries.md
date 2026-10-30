# Centros — Queries

Leituras no servidor (`'server-only'`), protegidas por `withPermission`/`withTenant`; o `company_id` entra automaticamente pela extensão Prisma.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `listFinancialCentersData(raw: Record<string, unknown>)` | PaginatedCenters | financial-centers:view | listFinancialCentersQuerySchema |  |
| `getCenterByIdData(id: string)` | Center | financial-centers:view | — |  |
| `getCenterFiltersData(raw: Record<string, unknown>)` | Record<string, unknown> | financial-centers:view | — |  |
