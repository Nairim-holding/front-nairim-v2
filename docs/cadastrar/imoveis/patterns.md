# Imóveis — Padrões de código

## Server Action (`src/server/actions/property.ts`)
```ts
export async function createUnifiedPropertyAction(formData: FormData): Promise<ActionResult<Property>> {
  return runAction(async () => {
    const combined = parseUnifiedFormData(formData);
    const data = createUnifiedPropertySchema.parse(combined) as unknown as CreateUnifiedPropertyData;

    const featuredImageIdentifier = readStringField(formData, 'featuredImageIdentifier') || undefined;
    const files = await readPropertyUploadFiles(formData);

    return withPermissionInput('properties', 'create', data, (session) =>
      propertyUseCases.createUnified.execute({ data, files, userId: session.id, featuredImageIdentifier }),
    );
  });
}
```

## Chamada no cliente (`src/app/dashboard/(cadastro)/imoveis/cadastrar/PropertyCreateForm.tsx`)
```tsx
    const fd = buildPropertyFormData(resolved, user?.id ?? '');
    const result = await createUnifiedPropertyAction(fd);
    if (!result.ok) {
      if (result.status === 400 && result.errors) {
        throw new Error(`Erro de validação: ${result.errors.join(', ')}`);
```
