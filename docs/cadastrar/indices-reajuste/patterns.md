# Índices de reajuste — Padrões de código

## Server Action (`src/server/actions/adjustment-index.ts`)
```ts
export async function createAdjustmentIndexAction(
  input: Record<string, unknown>,
): Promise<ActionResult<AdjustmentIndex>> {
  return runAction(async () => {
    const data = createAdjustmentIndexSchema.parse(input);
    return withPermissionInput('adjustment-indexes', 'create', input, () => adjustmentIndexUseCases.create.execute(data));
  });
}
```
