'use server';

import { backupUseCases } from '@/infra/factories/backup-factory';
import { withTenant } from '@/infra/auth/session';
import { type ActionResult, runAction } from '@/shared/actions/action-result';
import { NotFoundError, ValidationError } from '@/core/errors/domain-errors';
import type { AutoBackupInfo, BackupPayload, RestoreOutcome } from '@/core/entities/backup';

/**
 * Server Actions do módulo Backup (Configurações → Backup).
 * Guarda: `withTenant` com papel ADMIN (equivale a `requireAdmin` do backend).
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
      return { payload, filename };
    }, { role: 'admin' }),
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
    }, { role: 'admin' }),
  );
}

export async function listAutoBackupsAction(): Promise<ActionResult<AutoBackupInfo[]>> {
  return runAction(() =>
    withTenant(async (session) => {
      const company = await backupUseCases.companyById(session.company_id);
      if (!company) throw new NotFoundError('Empresa não encontrada');
      return backupUseCases.listAuto.execute(company.slug);
    }, { role: 'admin' }),
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
      return file;
    }, { role: 'admin' }),
  );
}