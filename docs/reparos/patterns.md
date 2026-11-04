# Reparos — Padrões de código

## Server Action (`src/server/actions/repair.ts`)
```ts
export async function saveRepairAction(id: string | null, raw: Record<string, unknown>) {
  return runAction(() => withPermissionInput('repairs', id ? 'edit' : 'create', raw, session =>
    repairsRepository.save(session.company_id, id ? z.string().uuid().parse(id) : null, repairSchema.parse(raw))));
}
```

## Chamada no cliente (`src/app/dashboard/reparos/_components/RepairForm.tsx`)
```tsx
      setItems(current => current.map(item => ({ ...item, supplier_id: resolved.get(item.supplier_id)! })));
      const result = await saveRepairAction(saved?.id ?? null, { ...parsed.data, supplier_ids: supplierIds,
        items: parsed.data.items.map(item => ({ ...item, supplier_id: resolved.get(item.supplier_id)! })) });
      if (!result.ok) throw new Error(describeActionError(result));
      setResponsibles(result.data.professionals.map(p => p.supplier_id));
```
