# Alertas de atrasos — Padrões de código

## Server Action (`src/server/actions/lease-overdue.ts`)
```ts
export async function getOverdueLeaseAlertsAction(): Promise<ActionResult<LeaseOverdueSummary>> {
  return runAction(() => listOverdueLeasesData());
}
```

## Chamada no cliente (`src/components/domain/lease-overdue/LeaseOverdueBell.tsx`)
```tsx
  const refresh = useCallback(async () => {
    const result = await getOverdueLeaseAlertsAction();
    if (result.ok) setSummary(result.data);
    setLoaded(true);
  }, []);
```
