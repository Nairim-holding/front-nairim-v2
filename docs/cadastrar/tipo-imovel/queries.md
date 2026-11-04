# Tipo de imóvel — Queries

Leituras no servidor (`'server-only'`), protegidas por `withPermission`/`withTenant`; o `company_id` entra automaticamente pela extensão Prisma.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `listPropertyTypesData(raw: Record<string, unknown>)` | PaginatedPropertyTypes | property-types:view | listPropertyTypesQuerySchema |  |
| `getPropertyTypeByIdData(id: string)` | PropertyType | property-types:view | — |  |
| `getPropertyTypeFiltersData(raw: Record<string, unknown>)` | Record<string, unknown> | property-types:view | — |  |
