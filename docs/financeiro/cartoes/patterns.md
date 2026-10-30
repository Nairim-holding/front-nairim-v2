# Cartões de crédito — Padrões de código

## Server Action (`src/server/actions/financial-card.ts`)
```ts
export async function createFinancialCardAction(input: Record<string, unknown>): Promise<ActionResult<Card>> {
  return runAction(async () => {
    const data = createFinancialCardSchema.parse(input);
    return withPermissionInput('financial-cards', 'create', input, () => financialCardUseCases.create.execute(data));
  });
}
```

## Chamada no cliente (`src/app/dashboard/(financeiro)/cartoes/_components/CardManagement.tsx`)
```tsx
                    if (formMode === 'CREATE') {
                      const result = await createFinancialCardAction(payload);
                      if (!result.ok) throw new Error(describeActionError(result, 'Erro ao criar Cartão.'));
                      return result.data;
                    }
```
