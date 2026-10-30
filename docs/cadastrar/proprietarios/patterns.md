# Proprietários — Padrões de código

## Server Action (`src/server/actions/owner.ts`)
```ts
export async function createOwnerAction(input: Record<string, unknown>): Promise<ActionResult<Owner>> {
  return runAction(async () => {
    const data = createOwnerSchema.parse(input);
    return withPermissionInput('owners', 'create', input, () => ownerUseCases.create.execute(data));
  });
}
```

## Chamada no cliente (`src/app/dashboard/(cadastro)/proprietarios/cadastrar/page.tsx`)
```tsx
      const result = await createOwnerAction(formattedData);

      if (!result.ok) {
        if (result.status === 400 && result.errors) {
```
