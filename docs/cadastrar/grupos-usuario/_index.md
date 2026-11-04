# Grupos de usuário

Grupos de usuário e a matriz de permissões (recurso × ação) que define o que cada grupo pode ver, criar, editar, excluir e exportar.

| Aspecto | Detalhe |
|---|---|
| Menu | Cadastrar > Grupo de Usuário |
| Rota | `/dashboard/grupos-usuario` |
| Permissão | recurso `user-groups` (ver, criar, editar, excluir) |
| Modelos Prisma | `UserGroup`, `UserGroupPermission` |
| Server | `server/actions/user-group.ts`, `server/actions/permission.ts`, `server/queries/user-group.ts`, `server/queries/permission.ts` |
| Domínio | `core/use-cases/permission/get-my-permissions.ts`, `core/use-cases/user-group/clone.ts`, `core/use-cases/user-group/crud.ts`, `core/entities/user-group.ts`, `core/entities/user-group-permission.ts` |
| Infra | `infra/repositories/prisma-user-group-permissions-repository.ts`, `infra/repositories/prisma-user-groups-repository.ts` |

## Arquivos desta pasta
[domain.md](domain.md) · [actions.md](actions.md) · [queries.md](queries.md) · [telas.md](telas.md) · [patterns.md](patterns.md) · [changelog.md](changelog.md)

## Para mexer neste módulo, saiba que
1. A lista de recursos vem de `src/shared/utils/menu-resources.ts` (`MENU_RESOURCES`); ações possíveis: `view`, `create`, `edit`, `delete`, `export`, `custom_field`. Recurso novo = só nessa constante.
2. Cada permissão é uma linha de `UserGroupPermission` com colunas `can_view`, `can_create`, `can_edit`, `can_delete`, `can_export`, `can_custom_field`.
3. Só `SUPER_ADMIN` tem bypass total; `ADMIN` sem grupo é irrestrito na própria empresa, mas fica restrito assim que entra num grupo com matriz configurada (`withPermission`, `infra/auth/session.ts`).
4. Grupo ausente, excluído ou de outra empresa nega acesso. Descrição do grupo é única por empresa.
5. Matriz também controla `audit-logs/delete` e `audit-logs/export` (expurgo e exportação de logs).
6. Exclusão é lógica (`deleted_at`); restaurar só funciona em registro excluído.
