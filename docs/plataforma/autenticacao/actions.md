# Autenticação e sessão — Server Actions

Retornam `ActionResult<T>` (`{ ok: true, data } | { ok: false, error, status }`) via `runAction`.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `loginAction(input: { email: string; password: string })` | LoginActionResult> { const parsed = loginSchema.safeParse(in | herdada da query | loginSchema | Autentica e grava o cookie de sessão no servidor. Limita por conta: 5 falhas → bloqueio de 5 min, mesmo se o IP informado mudar. |
| `refreshSessionAction()` | — | herdada da query | — |  |
| `logoutAction()` | — | herdada da query | — |  |
| `changePasswordAction(userId: string, input: { oldPassword: string; newPassword: string },)` | — | herdada da query | changePasswordSchema | Troca a senha do usuário informado, validando a senha atual. Exige sessão válida (mais forte que o backend, que só exigia Bearer p |
| `requestPasswordResetAction(email: string)` | — | herdada da query | requestPasswordResetSchema |  |
| `resetPasswordAction(input: { token: string; newPassword: string },)` | — | herdada da query | resetPasswordSchema |  |
