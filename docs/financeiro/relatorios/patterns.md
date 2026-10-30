# Relatórios financeiros — Padrões de código

## Server Action (`src/server/actions/financial-report.ts`)
```ts
export async function getGroupedReportAction(raw: Record<string, unknown>): Promise<ActionResult<GroupedReportResult>> {
  return runAction(() => getGroupedReportData(raw));
}
```

## Chamada no cliente (`src/app/dashboard/(financeiro)/relatorios/_components/GroupedReportView.tsx`)
```tsx
        raw.groupBy = groupBy;
        const result = await getGroupedReportAction(raw);
        if (!result.ok) throw new Error(result.error);
        // A action serializa `event_date`/`effective_date: Date` para string no
        // round-trip servidor→cliente (JSON não tem tipo Date) — mesmo shape
```
