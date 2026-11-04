# Vitrine pública de imóveis — Queries

Leituras no servidor (`'server-only'`), protegidas por `withPermission`/`withTenant`; o `company_id` entra automaticamente pela extensão Prisma.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `getPublicPropertiesData(slug: string, raw: Record<string, unknown>, opts?: { availableOnly?: boolean },)` | PublicPaginated<PublicProperty> | herdada da query | — |  |
| `getPublicPropertyByIdData(slug: string, id: string)` | PublicProperty / null | herdada da query | — |  |
| `getPublicOwnersData(slug: string, raw: Record<string, unknown>,)` | PublicPaginated<PublicOwner> | herdada da query | — |  |
| `getPublicPropertyTypesData(slug: string, raw: Record<string, unknown>,)` | PublicPaginated<PublicPropertyType> | herdada da query | — |  |
| `getPublicAgenciesData(slug: string, raw: Record<string, unknown>,)` | PublicPaginated<PublicAgency> | herdada da query | — |  |
