# Lançamentos — Padrões de código

## Server Action (`src/server/actions/financial-transaction.ts`)
```ts
export async function createFinancialTransactionAction(
  input: Record<string, unknown>,
): Promise<ActionResult<Transaction>> {
  return runAction(async () => {
    const data = createFinancialTransactionSchema.parse(input);
    return withPermissionInput('financial-transactions', 'create', input, () => financialTransactionUseCases.create.execute(data));
  });
}
```

## Chamada no cliente (`src/app/dashboard/(financeiro)/lancamentos/page.tsx`)
```tsx
      const created = await createFinancialTransactionAction(resolved);
      if (!created.ok) {
        throw new Error(created.error ?? 'Erro ao criar lançamento.');
      }
```
