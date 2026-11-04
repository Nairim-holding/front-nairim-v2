# Inquilinos — Padrões de código

## Server Action (`src/server/actions/tenant.ts`)
```ts
export async function createTenantAction(input: Record<string, unknown>): Promise<ActionResult<Tenant>> {
  return runAction(async () => {
    const data = createTenantSchema.parse(input);
    return withPermissionInput('tenants', 'create', input, () => tenantUseCases.create.execute(data));
  });
}
```

## Chamada no cliente (`src/app/dashboard/(cadastro)/inquilinos/cadastrar/page.tsx`)
```tsx
      const result = await createTenantAction(formattedData);

      if (!result.ok) {
        if (result.status === 409) {
```
