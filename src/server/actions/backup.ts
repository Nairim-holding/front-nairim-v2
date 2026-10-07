'use server';

import { backupUseCases } from '@/infra/factories/backup-factory';
import prisma from '@/infra/database/prisma';
import { writeTransferAuditEvent } from '@/infra/database/audit-events';
import { withTenant } from '@/infra/auth/session';
import { type ActionResult, runAction } from '@/shared/actions/action-result';
import { NotFoundError, ValidationError } from '@/core/errors/domain-errors';
import type { AutoBackupInfo, BackupPayload, RestoreOutcome } from '@/core/entities/backup';

/**
 * Server Actions do módulo Backup (Configurações → Backup).
 * Guarda: SUPER_ADMIN. Backups completos contêm hashes de senha e papéis;
 * permitir exportação/restauração a administradores de tenant escalava privilégios.
 * Camada: server. Origem: BackupController.
 */

export type ExportBackupResult = { payload: BackupPayload; filename: string };

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
      });
      return { payload, filename };
    }, { role: 'superAdmin' }),
  );
}

export async function restoreBackupAction(input: {
  backupJson: string;
  confirmationName: string;
}): Promise<ActionResult<RestoreOutcome>> {
  return runAction(() =>
    withTenant(async (session) => {
      let backupData: BackupPayload;
      try {
        backupData = JSON.parse(input.backupJson) as BackupPayload;
      } catch {
        throw new ValidationError('Arquivo de backup não é um JSON válido');
      }
      return backupUseCases.restore.execute(session.company_id, backupData, input.confirmationName);
    }, { role: 'superAdmin' }),
  );
}

export async function listAutoBackupsAction(): Promise<ActionResult<AutoBackupInfo[]>> {
  return runAction(() =>
    withTenant(async (session) => {
      const company = await backupUseCases.companyById(session.company_id);
      if (!company) throw new NotFoundError('Empresa não encontrada');
      return backupUseCases.listAuto.execute(company.slug);
    }, { role: 'superAdmin' }),
  );
}

export async function downloadAutoBackupAction(
  filename: string,
): Promise<ActionResult<{ name: string; content: string } | null>> {
  return runAction(() =>
    withTenant(async (session) => {
      const company = await backupUseCases.companyById(session.company_id);
      if (!company) throw new NotFoundError('Empresa não encontrada');
      const file = backupUseCases.downloadAuto.execute(company.slug, filename);
      if (!file) throw new NotFoundError('Backup automático não encontrado');
      const counts = Object.fromEntries(Object.entries((JSON.parse(file.content) as BackupPayload).data)
        .map(([model, rows]) => [model, Array.isArray(rows) ? rows.length : rows ? 1 : 0]));
      await writeTransferAuditEvent(prisma, {
        action: 'EXPORT', tableName: 'Backup', companyId: session.company_id,
        description: 'Exportação de backup automático', format: 'JSON', counts,
        recordCount: Object.values(counts).reduce((sum, count) => sum + count, 0),
      });
      return file;
    }, { role: 'superAdmin' }),
  );
}
