# Configurações — Server Actions

Retornam `ActionResult<T>` (`{ ok: true, data } | { ok: false, error, status }`) via `runAction`.

| Função | Retorno | Permissão | Validação | Descrição |
|---|---|---|---|---|
| `exportBackupAction()` | — | sessão (superAdmin) | — |  |
| `restoreBackupAction(input: { backupJson: string; confirmationName: string; })` | — | sessão (superAdmin) | — |  |
| `listAutoBackupsAction()` | — | sessão (superAdmin) | — |  |
| `downloadAutoBackupAction(filename: string,)` | — | sessão (superAdmin) | — |  |
| `exportTableDataAction(key: string, scope: 'current' / 'all' = 'current')` | — | herdada da query | — |  |
| `previewTableImportAction(key: string, form: FormData)` | — | herdada da query | — |  |
| `importTableDataAction(key: string, form: FormData)` | — | herdada da query | — |  |
| `previewCompanyDataDeletionAction(input: unknown)` | — | herdada da query | — |  |
| `deleteCompanyDataAction(input: unknown)` | — | herdada da query | — |  |
| `logStorageStatusAction()` | — | audit-logs:view | — |  |
| `previewLogPurgeAction(input: unknown)` | — | audit-logs:delete | logSelectionSchema |  |
| `purgeLogsAction(input: unknown)` | — | audit-logs:delete | — |  |
