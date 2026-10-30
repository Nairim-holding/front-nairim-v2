# Grupos de usuário — Telas

## `/dashboard/grupos-usuario/cadastrar` — Dados do Grupo de Usuário
Arquivo: `src/app/dashboard/(cadastro)/grupos-usuario/cadastrar/page.tsx` (127 linhas)
- Campos do formulário: Descrição, Permissões por item de menu
- Componentes: `form/DynamicForm`, `domain/userGroups/PermissionMatrix`

## `/dashboard/grupos-usuario/editar/[id]` — Dados do Grupo de Usuário
Arquivo: `src/app/dashboard/(cadastro)/grupos-usuario/editar/[id]/page.tsx` (153 linhas)
- Campos do formulário: Descrição, Permissões por item de menu
- Componentes: `form/DynamicForm`, `domain/userGroups/PermissionMatrix`, `domain/userGroups/AuditFooter`

## `/dashboard/grupos-usuario` — Grupos de Usuário
Arquivo: `src/app/dashboard/(cadastro)/grupos-usuario/page.tsx` (27 linhas)
- Colunas da lista: Descrição, Cadastrado por, Cadastrado em, Alterado por, Última alteração
- Componentes: `layout/PageSection`, `table/TableSkeleton`

## `/dashboard/grupos-usuario/visualizar/[id]` — Informações do Grupo de Usuário
Arquivo: `src/app/dashboard/(cadastro)/grupos-usuario/visualizar/[id]/page.tsx` (96 linhas)
- Campos do formulário: Descrição, Permissões por item de menu
- Componentes: `form/DynamicForm`, `domain/userGroups/PermissionMatrix`, `domain/userGroups/AuditFooter`
