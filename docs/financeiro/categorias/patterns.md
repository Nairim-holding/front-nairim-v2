# Categorias e subcategorias — Padrões de código

## Server Action (`src/server/actions/financial-category.ts`)
```ts
export async function createFinancialCategoryAction(input: Record<string, unknown>): Promise<ActionResult<Category>> {
  return runAction(async () => {
    const data = createFinancialCategorySchema.parse(input);
    return withPermissionInput('financial-categories', 'create', input, () => financialCategoryUseCases.create.execute(data));
  });
}
```

## Chamada no cliente (`src/app/dashboard/(financeiro)/categorias/page.tsx`)
```tsx
      mode === 'CREATE'
        ? await createFinancialCategoryAction(payload)
        : await updateFinancialCategoryAction(data.id, payload);

    if (!result.ok) throw new Error(result.error ?? 'Erro ao salvar Categoria.');
```
