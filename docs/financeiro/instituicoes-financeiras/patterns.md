# Instituições financeiras — Padrões de código

## Server Action (`src/server/actions/financial-institution.ts`)
```ts
export async function createFinancialInstitutionAction(input: Record<string, unknown>): Promise<ActionResult<FinancialInstitution>> {
  return runAction(async () => {
    const data = createFinancialInstitutionSchema.parse(input);
    return withPermissionInput('financial-institutions', 'create', input, () => financialInstitutionUseCases.create.execute(data));
  });
}
```

## Chamada no cliente (`src/app/dashboard/(financeiro)/instituicoes-financeiras/page.tsx`)
```tsx
                    if (formMode === 'CREATE') {
                      const result = await createFinancialInstitutionAction(payload);
                      if (!result.ok) throw new Error(result.error || 'Erro ao criar Instituição.');
                      return result.data;
                    }
```
