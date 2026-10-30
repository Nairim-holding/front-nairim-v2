# Relatórios de locações — Padrões de código

## Server Action (`src/server/actions/lease-report.ts`)
```ts
export async function getLeaseReportAction(raw: Record<string, unknown>): Promise<ActionResult<LeaseReportResult>> {
  return runAction(() => getLeaseReportData(raw));
}
```

## Chamada no cliente (`src/app/dashboard/(cadastro)/locacoes/relatorios/content.tsx`)
```tsx
    try {
      const result = await getLeaseReportAction({ months, company_ids: companyIds });
      if (version !== generationVersion.current) return;
      if (!result.ok) throw new Error(result.error);
      setGenerated({ key: reportKey, data: result.data });
```
