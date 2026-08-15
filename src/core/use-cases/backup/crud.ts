import type { BackupRepository } from '@/core/repositories/backup-repository';
import type { BackupFileStore } from '@/core/storage/backup-file-store';
import type { BackupPayload, RestoreOutcome } from '@/core/entities/backup';
import { BACKUP_FORMAT_VERSION } from '@/core/entities/backup';
import { buildChecksum } from '@/core/utils/backup-filename';
import { NotFoundError, ValidationError } from '@/core/errors/domain-errors';

/**
 * Use-cases do módulo Backup.
 * Fonte fiel: api-nairim-v2/src/services/BackupService.ts.
 *
 * A validação de negócio (confirmação, estrutura, formatVersion, company_id,
 * checksum) fica aqui — testável com mocks — enquanto o repositório Prisma faz
 * apenas o trabalho de banco (export/transação destrutiva) e o file store grava
 * em disco. O auto-backup (salvar o estado atual antes de destruir) é orquestrado
 * no use-case, como no backend.
 *
 * Camada: core.
 */

/** Exporta todos os dados da empresa (GET /backup/export). */
export class ExportBackupUseCase {
  constructor(private readonly repo: BackupRepository) {}

  execute(companyId: string): Promise<BackupPayload> {
    return this.repo.exportCompany(companyId);
  }
}

/** Restaura a empresa a partir de um backup (POST /backup/restore). Destrutivo. */
export class RestoreBackupUseCase {
  constructor(
    private readonly repo: BackupRepository,
    private readonly store: BackupFileStore,
  ) {}

  async execute(companyId: string, backupData: BackupPayload, confirmationName: string): Promise<RestoreOutcome> {
    const company = await this.repo.getCompanyById(companyId);
    if (!company) throw new NotFoundError('Empresa não encontrada');

    // 1. Confirmação (nome OU slug da empresa, case-insensitive)
    const isValidConfirmation =
      confirmationName.toLowerCase() === company.name.toLowerCase() ||
      confirmationName.toLowerCase() === company.slug.toLowerCase();
    if (!isValidConfirmation) {
      throw new ValidationError(
        `Confirmação inválida. Digite exatamente "${company.name}" ou "${company.slug}" para prosseguir.`,
      );
    }

    // 2. Estrutura (meta + data)
    if (!backupData?.meta || !backupData?.data) {
      throw new ValidationError('Arquivo de backup inválido (estrutura esperada: meta + data)');
    }

    // 3. Versão do formato
    if (backupData.meta.formatVersion !== BACKUP_FORMAT_VERSION) {
      throw new ValidationError(
        `Versão do backup incompatível. Esperado: v${BACKUP_FORMAT_VERSION}, recebido: v${backupData.meta.formatVersion}`,
      );
    }

    // 4. Empresa (o backup pertence a esta empresa?)
    if (backupData.meta.company_id !== companyId) {
      throw new ValidationError(
        `Backup não corresponde a esta empresa. ID no arquivo: ${backupData.meta.company_id}, ID atual: ${companyId}`,
      );
    }

    // 5. Checksum (arquivo corrompido?)
    const actualChecksum = buildChecksum(backupData.data);
    if (actualChecksum !== backupData.meta.checksum) {
      throw new ValidationError('Checksum do backup não corresponde. Arquivo pode estar corrompido.');
    }

    // 6. Auto-backup do estado ATUAL antes de destruir (para reverter).
    const current = await this.repo.exportCompany(companyId);
    const autoBackupName = this.store.writeAutoBackup(company.slug, current);

    // 7. Transação destrutiva: apaga e reinsere.
    await this.repo.restoreCompany(companyId, backupData);

    const totalRecords = Object.values(backupData.data).reduce(
      (sum: number, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
      0,
    );

    return {
      success: true,
      company_id: companyId,
      company_name: company.name,
      message: `Empresa "${company.name}" restaurada com sucesso (${totalRecords} registros)`,
      autoBackupName,
    };
  }
}

/** Lista os auto-backups (pré-restore) de uma empresa (GET /backup/auto). */
export class ListAutoBackupsUseCase {
  constructor(private readonly store: BackupFileStore) {}

  execute(companySlug: string) {
    return this.store.listAutoBackups(companySlug);
  }
}

/** Baixa um auto-backup específico (GET /backup/auto/:filename). */
export class DownloadAutoBackupUseCase {
  constructor(private readonly store: BackupFileStore) {}

  execute(companySlug: string, filename: string): { name: string; content: string } | null {
    const content = this.store.readAutoBackup(companySlug, filename);
    if (content === null) return null;
    return { name: filename, content };
  }
}