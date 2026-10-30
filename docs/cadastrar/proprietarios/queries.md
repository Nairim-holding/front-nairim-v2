# Proprietários — Queries

Leituras no servidor (`'server-only'`), protegidas por `withPermission`/`withTenant`; o `company_id` entra automaticamente pela extensão Prisma.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `listOwnersData(raw: Record<string, unknown>)` | PaginatedOwners | owners:view | listOwnersQuerySchema |  |
| `getOwnerByIdData(id: string)` | Owner | owners:view | — |  |
| `getOwnerFiltersData(raw: Record<string, unknown>)` | Record<string, unknown> | owners:view | — |  |
| `getOwnerContactSuggestionsData(search: string)` | ContactSuggestion[] | owners:view | — |  |
