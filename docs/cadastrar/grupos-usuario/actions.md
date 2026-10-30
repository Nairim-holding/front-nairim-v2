# Grupos de usuário — Server Actions

Retornam `ActionResult<T>` (`{ ok: true, data } | { ok: false, error, status }`) via `runAction`.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `createUserGroupAction(input: Record<string, unknown>)` | UserGroup | user-groups:create | createUserGroupSchema |  |
| `updateUserGroupAction(id: string, input: Record<string, unknown>)` | UserGroup | user-groups:edit | updateUserGroupSchema |  |
| `deleteUserGroupAction(id: string)` | null | user-groups:delete | — |  |
| `restoreUserGroupAction(id: string)` | null | user-groups:edit | — |  |
| `cloneUserGroupAction(sourceId: string, input: Record<string, unknown>)` | CloneUserGroupResult | user-groups:create | createUserGroupSchema | Clonar exige permissão de CRIAÇÃO — o resultado é um grupo novo, não uma edição. |
| `upsertUserGroupPermissionsAction(id: string, input: Record<string, unknown>)` | PermissionRow[] | user-groups:edit | upsertPermissionsSchema |  |
| `listUserGroupsAction(raw: Record<string, unknown>)` | PaginatedUserGroups | herdada da query | — |  |
| `getUserGroupByIdAction(id: string)` | UserGroup | herdada da query | — |  |
| `getUserGroupFiltersAction(raw: Record<string, unknown>)` | Record<string, unknown> | herdada da query | — |  |
| `getResourceCatalogAction()` | ResourceCatalogItem[] | herdada da query | — |  |
| `getGroupPermissionsAction(id: string)` | PermissionRow[] | herdada da query | — |  |
| `getMyPermissionsAction()` | ResolvedPermissionsResponse | herdada da query | — |  |
