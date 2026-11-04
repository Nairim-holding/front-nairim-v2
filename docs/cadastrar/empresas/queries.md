# Empresas — Queries

Leituras no servidor (`'server-only'`), protegidas por `withPermission`/`withTenant`; o `company_id` entra automaticamente pela extensão Prisma.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `getPublicBrandingData(slug: string)` | PublicBranding | herdada da query | — |  |
| `getMyBrandingData()` | CompanyBranding / null | herdada da query | — |  |
| `checkSlugAvailabilityData(slug: string)` | { available: boolean } | herdada da query | — |  |
| `listCompaniesData(params: Record<string, unknown>)` | CompanyListResult | herdada da query | listCompaniesQuerySchema |  |
| `getCompanyByIdData(id: string)` | CompanyWithBranding | herdada da query | — |  |
| `getCompanyFiltersData()` | Record<string, unknown> | herdada da query | — |  |
