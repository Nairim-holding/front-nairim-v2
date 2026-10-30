# Autenticação e sessão

Login, sessão, renovação, troca e recuperação de senha, e a regra de acesso por empresa e horário.

| Aspecto | Detalhe |
|---|---|
| Menu | Login (/login e /<slug>/login) |
| Rota | `/login`, `/<slug>/login` |
| Permissão | pública |
| Modelos Prisma | `User`, `Company` |
| Server | `server/actions/auth.ts` |
| Domínio | `core/use-cases/auth/change-password.ts`, `core/use-cases/auth/get-current-user.ts`, `core/use-cases/auth/login.ts`, `core/entities/company-access.ts` |
| Infra | — |

## Arquivos desta pasta
[domain.md](domain.md) · [actions.md](actions.md) · [queries.md](queries.md) · [telas.md](telas.md) · [patterns.md](patterns.md) · [changelog.md](changelog.md)

## Para mexer neste módulo, saiba que
1. Sessão é um JWT (HS256) no cookie `authToken`, mais `company_slug`; `JWT_EXPIRES_IN` define a expiração absoluta (padrão 8 h) e a inatividade é tratada no front.
2. Cada requisição valida conta, grupo e restrição de horário (`infra/auth/live-session.ts`); usuário excluído, grupo inválido ou fora do horário perde acesso.
3. Limitador de login: 5 falhas por conta (`infra/security/login-rate-limiter.ts`), independente do IP informado pelo cliente; estado em memória do processo (várias réplicas exigiriam armazenamento compartilhado). As variáveis `RATE_LIMIT_*` não o configuram.
4. `authToken` é legível por JavaScript (coexistência com `authFetch`/backend legado); tornar HttpOnly exige migrar os consumidores.
5. O cliente só restaura a autenticação com documento ativo, aba autenticada que responda ou passagem imediata após login/troca de empresa; cookies sem prazo e expiração por inatividade continuam.
6. `src/middleware.ts` protege `/dashboard` e `/<slug>/dashboard` e redireciona não autenticados para `/login`.
