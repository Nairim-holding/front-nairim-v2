# Empresas — Padrões de código

## Server Action (`src/server/actions/company.ts`)
```ts
export async function createCompanyAction(input: Record<string, unknown>): Promise<ActionResult<CompanyWithBranding>> {
  return runAction(async () => {
    const session = await requireSession();
    assertSuperAdmin(session);
    return companyUseCases.create.execute({
      name: input.name as string | undefined,
      slug: input.slug as string | undefined,
      db_quota_mb: input.db_quota_mb as number | null | undefined,
      ...pickBrandingFields(input),
    });
  });
}
```

## Chamada no cliente (`src/app/dashboard/empresas/cadastrar/page.tsx`)
```tsx
    const result = await createCompanyAction(payload);
    if (!result.ok) throw new Error(result.error ?? `Erro ${result.status}`);
    return result;
  }
```
