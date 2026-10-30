# Imóveis — Queries

Leituras no servidor (`'server-only'`), protegidas por `withPermission`/`withTenant`; o `company_id` entra automaticamente pela extensão Prisma.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `listPropertiesData(raw: Record<string, unknown>)` | PaginatedProperties | properties:view | listPropertiesQuerySchema |  |
| `getPropertyByIdData(id: string)` | Property | properties:view | — |  |
| `getPropertyFiltersData(raw: Record<string, unknown>)` | Record<string, unknown> | properties:view | — |  |
