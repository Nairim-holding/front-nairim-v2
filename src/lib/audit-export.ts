import { auditPreparedExportAction } from '@/server/actions/export-audit';

/** Wait for durable audit acknowledgement before handing the file to the browser. */
export async function auditPreparedExport(resource: string, format: 'XLSX' | 'PDF', recordCount: number) {
  const result = await auditPreparedExportAction({ resource, format, recordCount });
  if (!result.ok) throw new Error(result.error);
}
