'use server';

import { z } from 'zod';
import prisma from '@/infra/database/prisma';
import { withPermission, assertAdmin, assertSuperAdmin } from '@/infra/auth/session';
import { writeTransferAuditEvent } from '@/infra/database/audit-events';
import { TRANSFER_TABLES } from '@/shared/data/table-transfer';
import { normalizeResourceKey } from '@/utils/permissionResource';
import { runAction } from '@/shared/actions/action-result';
import { ValidationError } from '@/core/errors/domain-errors';

const schema = z.object({
  resource: z.string().min(1).max(80),
  format: z.enum(['XLSX', 'PDF']),
  recordCount: z.number().int().min(0).max(10000000),
});
const reports: Record<string, { model: string; label: string }> = {
  'financial-reports': { model: 'FinancialReport', label: 'Relatórios financeiros' },
  'lease-reports': { model: 'LeaseReport', label: 'Relatórios de locações' },
  'financial-audit': { model: 'FinancialAudit', label: 'Auditoria financeira' },
  'audit-logs': { model: 'AuditLog', label: 'Logs de auditoria' },
};

/** Records a prepared browser export; no downloaded file data is accepted. */
export async function auditPreparedExportAction(input: z.input<typeof schema>) {
  return runAction(async () => {
    const data = schema.parse(input);
    const resource = normalizeResourceKey(data.resource);
    const table = TRANSFER_TABLES.find(table => table.resource === resource);
    const target = table ?? reports[resource];
    if (!target) throw new ValidationError('Recurso não permitido para exportação.');
    return withPermission(resource, 'export', async session => {
      if (table?.global) assertSuperAdmin(session);
      if (table?.admin || resource === 'audit-logs') assertAdmin(session);
      await writeTransferAuditEvent(prisma, {
        action: 'EXPORT', tableName: target.model, companyId: session.company_id,
        description: `Arquivo preparado para exportação de ${target.label}`,
        format: data.format, recordCount: data.recordCount,
      });
    });
  });
}
