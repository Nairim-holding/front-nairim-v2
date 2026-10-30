# Usuários

Cadastro dos usuários que acessam o sistema na empresa: dados de login, papel, grupo de permissões e horário de acesso permitido.

| Aspecto | Detalhe |
|---|---|
| Menu | Cadastrar > Usuários |
| Rota | `/dashboard/administradores` |
| Permissão | recurso `users` (ver, criar, editar, excluir) |
| Modelos Prisma | `User`, `UserAccessSchedule` |
| Server | `server/actions/user.ts`, `server/queries/user.ts` |
| Domínio | `core/use-cases/user/crud.ts`, `core/entities/user.ts` |
| Infra | `infra/repositories/prisma-users-repository.ts` |

## Arquivos desta pasta
[domain.md](domain.md) · [actions.md](actions.md) · [queries.md](queries.md) · [telas.md](telas.md) · [patterns.md](patterns.md) · [changelog.md](changelog.md)

## Para mexer neste módulo, saiba que
1. Papéis (`Role`): `DEFAULT`, `MANAGER`, `ADMIN`, `SUPER_ADMIN`. Só `SUPER_ADMIN` cria ou altera contas `SUPER_ADMIN` e altera credenciais de contas privilegiadas.
2. Escritas exigem administrador **e** a permissão `users`. Usuário comum sem grupo não recebe acesso implícito; `ADMIN` sem grupo é irrestrito só na própria empresa.
3. E-mail não pode se repetir (`ConflictError`). O login busca o usuário por e-mail sem contexto de empresa (`infra/repositories/prisma-users-repository.ts`).
4. Restrição de horário: `UserAccessSchedule` (dia da semana, início, fim) é avaliada em `America/Sao_Paulo` na validação da sessão (`infra/auth/live-session.ts`, `access-schedule.ts`) quando `has_time_restriction` está ligado.
5. Exclusão é lógica (`deleted_at`); restaurar só funciona em registro excluído.
6. A transferência JSON de usuários exige administrador, remove acessos a outras empresas e só `SUPER_ADMIN` pode importar ou alterar `SUPER_ADMIN`.
