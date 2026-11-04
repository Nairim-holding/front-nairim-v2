# Contatos (fornecedores) — Padrões de código

## Server Action (`src/server/actions/financial-supplier.ts`)
```ts
export async function createFinancialSupplierAction(input: Record<string, unknown>): Promise<ActionResult<Supplier>> {
  return runAction(async () => {
    const data = createFinancialSupplierSchema.parse(input);
    return withPermissionInput('financial-suppliers', 'create', input, () => financialSupplierUseCases.create.execute(data));
  });
}
```

## Chamada no cliente (`src/app/dashboard/(financeiro)/fornecedores/page.tsx`)
```tsx
                        if (formMode === 'CREATE') {
                          const result = await createFinancialSupplierAction(payload);
                          if (!result.ok) throw new Error(result.error || 'Erro ao criar Contato.');
                          return result.data;
                        }
```
