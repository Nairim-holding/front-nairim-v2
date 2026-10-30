# Usuários — Queries

Leituras no servidor (`'server-only'`), protegidas por `withPermission`/`withTenant`; o `company_id` entra automaticamente pela extensão Prisma.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `listUsersData(raw: Record<string, unknown>)` | PaginatedUsers | users:view | listUsersQuerySchema |  |
| `getUserByIdData(id: string)` | UserDetail | users:view | — |  |
| `getUserFiltersData(raw: Record<string, unknown>)` | Record<string, unknown> | users:view | — |  |
