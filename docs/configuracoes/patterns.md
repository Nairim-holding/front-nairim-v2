# Configurações — Padrões de código

## Server Action (`src/server/actions/backup.ts`)
```ts
export async function exportBackupAction(): Promise<ActionResult<ExportBackupResult>> {
  return runAction(() =>
    withTenant(async (session) => {
      const payload = await backupUseCases.export.execute(session.company_id);
      const slug = payload.meta.company_slug || 'empresa';
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `backup-nairim-${slug}-${stamp}.json`;
      await writeTransferAuditEvent(prisma, {
        action: 'EXPORT', tableName: 'Backup', companyId: session.company_id,
        description: 'Exportação do backup da empresa', format: 'JSON',
        recordCount: Object.values(payload.meta.counts).reduce((sum, count) => sum + count, 0),
        counts: payload.meta.counts,
```

## Chamada no cliente (`src/app/dashboard/configuracoes/page.tsx`)
```tsx
    try {
      const result = await exportBackupAction();
      if (!result.ok) throw new Error(result.error ?? 'Erro ao gerar o backup.');

      const filename = result.data.filename;
```
