# Grupos de usuário — Queries

Leituras no servidor (`'server-only'`), protegidas por `withPermission`/`withTenant`; o `company_id` entra automaticamente pela extensão Prisma.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `listUserGroupsData(raw: Record<string, unknown>)` | PaginatedUserGroups | user-groups:view | listUserGroupsQuerySchema |  |
| `getUserGroupByIdData(id: string)` | UserGroup | user-groups:view | — |  |
| `getUserGroupFiltersData(raw: Record<string, unknown>)` | Record<string, unknown> | user-groups:view | — |  |
| `getResourceCatalogData()` | ResourceCatalogItem[] | user-groups:view | — |  |
| `getGroupPermissionsData(id: string)` | PermissionRow[] | user-groups:view | — |  |
| `getMyPermissionsData()` | ResolvedPermissionsResponse | sessão | — |  |
