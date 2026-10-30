# Locações — Padrões de código

## Server Action (`src/server/actions/lease.ts`)
```ts
export async function createLeaseAction(input: Record<string, unknown>): Promise<ActionResult<LeaseWithWarnings>> {
  return runAction(async () => {
    const data = createLeaseSchema.parse(input) as unknown as CreateLeaseData;
    const businessWarnings = validateLeaseBusinessRules(input, false);

    const lease = await withPermissionInput('leases', 'create', input, async () => { await assertLeaseFinancialSetup(data.property_id, data.agency_id); return leaseUseCases.create.execute(data); });

    const warnings = [...businessWarnings];
    if (lease.finance_warning) warnings.push(lease.finance_warning);
    const { finance_warning: _fw, ...rest } = lease; // eslint-disable-line @typescript-eslint/no-unused-vars
    return warnings.length > 0 ? { ...rest, warnings } : (rest as LeaseWithWarnings);
  });
}
```

## Chamada no cliente (`src/app/dashboard/(cadastro)/locacoes/cadastrar/page.tsx`)
```tsx
      const result = await createLeaseAction(formattedData);

      if (!result.ok) {
        if (result.status === 400 && (result as any).errors) {
```
