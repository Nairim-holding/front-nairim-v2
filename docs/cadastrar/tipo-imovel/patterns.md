# Tipo de imóvel — Padrões de código

## Server Action (`src/server/actions/property-type.ts`)
```ts
export async function createPropertyTypeAction(input: Record<string, unknown>): Promise<ActionResult<PropertyType>> {
  return runAction(async () => {
    const data = createPropertyTypeSchema.parse(input);
    return withPermissionInput('property-types', 'create', input, () => propertyTypeUseCases.create.execute(data));
  });
}
```

## Chamada no cliente (`src/app/dashboard/(cadastro)/tipo-imovel/cadastrar/page.tsx`)
```tsx
      const result = await createPropertyTypeAction(formattedData);

      if (!result.ok) {
        if (result.status === 409) {
```
