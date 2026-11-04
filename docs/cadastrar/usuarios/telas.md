# Usuários — Telas

## `/dashboard/administradores/cadastrar` — Dados do Usuário
Arquivo: `src/app/dashboard/(cadastro)/administradores/cadastrar/page.tsx` (273 linhas)
- Campos do formulário: Nome, Email, Data de Nascimento, Sexo, Papel, Senha, Confirmar Senha, Grupo de Usuário
- Outros rótulos: Masculino, Feminino, Outro, Usuário, Gestor, Administrador
- Componentes: `form/DynamicForm`

## `/dashboard/administradores/editar/[id]` — Dados do Usuário
Arquivo: `src/app/dashboard/(cadastro)/administradores/editar/[id]/page.tsx` (305 linhas)
- Campos do formulário: Nome, Email, Data de Nascimento, Sexo, Nova Senha, Confirmar Nova Senha, Grupo de Usuário, Papel (Role)
- Outros rótulos: Masculino, Feminino, Outro, Usuário, Gestor, Administrador, Super Administrador
- Componentes: `form/DynamicForm`

## `/dashboard/administradores` — Usuários
Arquivo: `src/app/dashboard/(cadastro)/administradores/page.tsx` (29 linhas)
- Colunas da lista: Nome, E-mail, Grupo usuário, Ativo, Sexo, Data de Nascimento, Criado em
- Componentes: `layout/PageSection`, `table/TableSkeleton`

## `/dashboard/administradores/visualizar/[id]` — Dados do Usuário
Arquivo: `src/app/dashboard/(cadastro)/administradores/visualizar/[id]/page.tsx` (130 linhas)
- Campos do formulário: Nome, Email, Data de Nascimento, Sexo, Ativo, Grupo de Usuário, Papel (Role), Horário restrito, Cadastrado por, Criado em, Alterado por, Atualizado em
- Componentes: `form/DynamicForm`
