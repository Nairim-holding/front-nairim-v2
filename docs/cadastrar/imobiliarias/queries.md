# Imobiliárias — Queries

Leituras no servidor (`'server-only'`), protegidas por `withPermission`/`withTenant`; o `company_id` entra automaticamente pela extensão Prisma.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `listAgenciesData(raw: Record<string, unknown>)` | PaginatedAgencies | agencies:view | listAgenciesQuerySchema |  |
| `getAgencyByIdData(id: string)` | Agency | agencies:view | — |  |
| `getAgencyFiltersData(raw: Record<string, unknown>)` | Record<string, unknown> | agencies:view | — |  |
| `getContactSuggestionsData(search: string)` | ContactSuggestion[] | agencies:view | — |  |
