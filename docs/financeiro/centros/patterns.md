# Centros — Padrões de código

## Server Action (`src/server/actions/financial-center.ts`)
```ts
export async function createFinancialCenterAction(input: Record<string, unknown>): Promise<ActionResult<Center>> {
  return runAction(async () => {
    const data = createFinancialCenterSchema.parse(input);
    return withPermissionInput('financial-centers', 'create', input, () => financialCenterUseCases.create.execute(data));
  });
}
```

## Chamada no cliente (`src/app/dashboard/(financeiro)/centros/page.tsx`)
```tsx
      mode === 'CREATE'
        ? await createFinancialCenterAction(payload)
        : await updateFinancialCenterAction(data.id, payload);

    if (!result.ok) throw new Error(result.error ?? 'Erro ao salvar Centro.');
```
