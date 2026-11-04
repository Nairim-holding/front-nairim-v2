# Planejamento e controle — Padrões de código

## Server Action (`src/server/actions/planning.ts`)
```ts
export async function upsertPlanningAction(
  input: Record<string, unknown>,
): Promise<ActionResult<Planning>> {
  return runAction(async () => {
    const data = planningUpsertSchema.parse(input);
    const payload = {
      category_id: data.category_id,
      subcategory_id: data.subcategory_id ?? undefined,
      type: data.type,
      default_amount: data.default_amount ?? undefined,
      monthly_values: data.monthly_values ?? [],
    };
    return withPermissionInput('planning', 'edit', input, () => planningUseCases.upsert.execute(payload));
  });
}
```

## Chamada no cliente (`src/app/dashboard/(financeiro)/planejamento/content.tsx`)
```tsx
      const res = await upsertPlanningAction(payload);

      console.log('\n📥 [INLINE SAVE] RESPOSTA RECEBIDA:');
      console.log('─────────────────────────────────────────────────────────────');
```
