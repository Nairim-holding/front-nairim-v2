# Grupos de usuário — Domínio

## Modelos Prisma (`prisma/schema.prisma`)
### UserGroup
- Campos: description: String; created_by: String?; updated_by: String?
- Relações: company → Company; creator → User; updater → User; members[] → User; permissions[] → UserGroupPermission
- Padrão: id, company_id, created_at, updated_at, deleted_at (exclusão lógica)

### UserGroupPermission
- Campos: user_group_id: String; resource: String; can_view: Boolean; can_create: Boolean; can_edit: Boolean; can_delete: Boolean; can_export: Boolean; can_custom_field: Boolean
- Relações: group → UserGroup; company → Company
- Únicos compostos: user_group_id, resource
- Padrão: id, company_id, created_at, updated_at

## Entidades e tipos (`src/core/entities`)
`UserGroup`, `CreateUserGroupData`, `UpdateUserGroupData`, `GetUserGroupsParams`, `PaginatedUserGroups`, `CloneUserGroupResult`, `PermissionRow`, `ResourceCatalogItem`, `ResolvedPermissions`, `UpsertPermissionsInput`, `ResolvedPermissionsResponse`

## Validação (Zod, `src/shared/validators`)
- createUserGroupSchema: description — user-group.ts
- updateUserGroupSchema: description — user-group.ts
- listUserGroupsQuerySchema: limit?, page?, search?, includeInactive? — user-group.ts
- upsertPermissionsSchema: permissions — user-group-permission.ts

## Regras de negócio
- A lista de recursos vem de `src/shared/utils/menu-resources.ts` (`MENU_RESOURCES`); ações possíveis: `view`, `create`, `edit`, `delete`, `export`, `custom_field`. Recurso novo = só nessa constante.
- Cada permissão é uma linha de `UserGroupPermission` com colunas `can_view`, `can_create`, `can_edit`, `can_delete`, `can_export`, `can_custom_field`.
- Só `SUPER_ADMIN` tem bypass total; `ADMIN` sem grupo é irrestrito na própria empresa, mas fica restrito assim que entra num grupo com matriz configurada (`withPermission`, `infra/auth/session.ts`).
- Grupo ausente, excluído ou de outra empresa nega acesso. Descrição do grupo é única por empresa.
- Matriz também controla `audit-logs/delete` e `audit-logs/export` (expurgo e exportação de logs).
- Exclusão é lógica (`deleted_at`); restaurar só funciona em registro excluído.

## Erros lançados nos use-cases
| Classe | Mensagem | Arquivo |
|---|---|---|
| NotFoundError | Grupo de usuário de origem não encontrado | clone.ts |
| ConflictError | Já existe um grupo de usuário com essa descrição | clone.ts |
| ValidationError | O ID é obrigatório | crud.ts |
| NotFoundError | Grupo de usuário não encontrado | crud.ts |
| ConflictError | Este grupo de usuário já existe | crud.ts |
| NotFoundError | Grupo de usuário não encontrado ou já excluído | crud.ts |
| ValidationError | O grupo de usuário não está excluído | crud.ts |
