# Imobiliárias — Padrões de código

## Server Action (`src/server/actions/agency.ts`)
```ts
export async function createAgencyAction(input: Record<string, unknown>): Promise<ActionResult<Agency>> {
  return runAction(async () => {
    const data = createAgencySchema.parse(input);
    return withPermissionInput('agencies', 'create', input, () => agencyUseCases.create.execute(data));
  });
}
```

## Chamada no cliente (`src/app/dashboard/(cadastro)/imobiliarias/cadastrar/CadastrarImobiliariaForm.tsx`)
```tsx
      const result = await createAgencyAction(formattedData);

      if (!result.ok) {
        if (result.status === 409 && result.error?.includes('CNPJ')) {
```
