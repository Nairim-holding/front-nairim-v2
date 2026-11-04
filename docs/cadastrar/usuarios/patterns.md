# Usuários — Padrões de código

## Server Action (`src/server/actions/user.ts`)
```ts
export async function createUserAction(input: Record<string, unknown>): Promise<ActionResult<UserProfile>> {
  return runAction(async () => {
    const data = createUserSchema.parse(input);
    return withPermission('users', 'create', async (session) => {
      await assertCanManageUser(session);
      if (data.role && data.role !== 'DEFAULT' && session.role !== 'SUPER_ADMIN') {
        throw new ForbiddenError('Apenas super administrador pode atribuir papéis administrativos.');
      }
      await assertCompanyAccessGrant(session, data);
      await assertUserGroupInTenant(data.user_group_id);
      return userUseCases.create.execute({ ...data, created_by: session.id });
    });
```

## Chamada no cliente (`src/app/dashboard/(cadastro)/administradores/cadastrar/page.tsx`)
```tsx
    const payload = transformResponse(data);
    const result = await createUserAction(payload);

    if (!result.ok) {
      if (result.status === 409) throw new Error('E-mail já cadastrado');
```
