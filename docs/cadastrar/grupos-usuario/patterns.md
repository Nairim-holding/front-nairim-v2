# Grupos de usuário — Padrões de código

## Server Action (`src/server/actions/user-group.ts`)
```ts
export async function createUserGroupAction(input: Record<string, unknown>): Promise<ActionResult<UserGroup>> {
  return runAction(async () => {
    const data = createUserGroupSchema.parse(input);
    return withPermission('user-groups', 'create', (session) =>
      userGroupUseCases.create.execute({ description: data.description, created_by: session.id }),
    );
  });
}
```

## Chamada no cliente (`src/app/dashboard/(cadastro)/grupos-usuario/cadastrar/page.tsx`)
```tsx
      // 1. Cria o grupo
      const result = await createUserGroupAction({ description: data.description });

      if (!result.ok) {
        if (result.status === 409) {
```

## Pegadinhas
- O menu lateral e o `PermissionGate` mapeiam rota → recurso em `src/utils/permissionResource.ts`; ao criar rota nova, atualize lá e em `menu-resources.ts`.
