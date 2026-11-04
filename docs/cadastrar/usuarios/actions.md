# Usuários — Server Actions

Retornam `ActionResult<T>` (`{ ok: true, data } | { ok: false, error, status }`) via `runAction`.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `createUserAction(input: Record<string, unknown>)` | — | users:create | createUserSchema |  |
| `updateUserAction(id: string, input: Record<string, unknown>)` | — | users:edit | updateUserSchema |  |
| `deleteUserAction(id: string)` | — | users:delete | — |  |
| `restoreUserAction(id: string)` | — | users:edit | — |  |
| `changeUserPasswordAction(id: string, input: { oldPassword: string; newPassword: string },)` | — | sessão | changeUserPasswordSchema |  |
| `listUsersAction(raw: Record<string, unknown>)` | — | herdada da query | — |  |
| `getUserByIdAction(id: string)` | — | herdada da query | — |  |
| `getUserFiltersAction(raw: Record<string, unknown>)` | — | herdada da query | — |  |
| `setActiveUserAction(id: string, isActive: boolean)` | — | users:edit | — |  |
| `uploadUserPhotoAction(id: string, formData: FormData)` | — | users:edit | — |  |
| `getUserScheduleAction(id: string)` | — | users:view | — |  |
| `setUserScheduleAction(id: string, schedules: AccessScheduleRow[],)` | — | users:edit | — |  |
