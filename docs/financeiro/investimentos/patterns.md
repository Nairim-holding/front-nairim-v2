# Meus investimentos — Padrões de código

## Server Action (`src/server/actions/investment.ts`)
```ts
export async function createInvestmentAction(
  input: Record<string, unknown>,
): Promise<ActionResult<Investment>> {
  return runAction(async () => {
    const data = createInvestmentSchema.parse(input);
    return withPermissionInput('investments', 'create', input, () =>
      investmentUseCases.create.execute({
        financial_institution_id: data.financial_institution_id,
        partition: data.partition ?? undefined,
        issuer: data.issuer,
        product_type: data.product_type,
        product: data.product,
        application_date: data.application_date,
        maturity_date: data.maturity_date ?? null,
        liquidity_days: data.liquidity_days ?? null,
        liquidity_at_maturity: data.liquidity_at_maturity ?? false,
```

## Chamada no cliente (`src/components/investimentos/InvestmentFormModal.tsx`)
```tsx
        ? await updateInvestmentAction(investment!.id, payload)
        : await createInvestmentAction(payload);
      if (!result.ok) throw new Error(result.errors?.join('; ') || result.error);
      showMessage(isEditing ? 'Investimento atualizado com sucesso' : 'Investimento criado com sucesso', 'success');
      onSaved();
```
