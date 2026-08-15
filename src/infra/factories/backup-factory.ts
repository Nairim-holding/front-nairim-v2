import { PrismaBackupRepository } from '@/infra/repositories/prisma-backup-repository';
import { NodeBackupFileStore } from '@/infra/storage/node-backup-file-store';
import {
  DownloadAutoBackupUseCase,
  ExportBackupUseCase,
  ListAutoBackupsUseCase,
  RestoreBackupUseCase,
} from '@/core/use-cases/backup/crud';

/** Composition root do módulo Backup. Camada: infra. */
const backupRepo = new PrismaBackupRepository();
const backupStore = new NodeBackupFileStore();

export const backupUseCases = {
  export: new ExportBackupUseCase(backupRepo),
  restore: new RestoreBackupUseCase(backupRepo, backupStore),
  listAuto: new ListAutoBackupsUseCase(backupStore),
  downloadAuto: new DownloadAutoBackupUseCase(backupStore),
  /** Empresa da sessão (com slug) para listar/baixar auto-backups. */
  companyById: (companyId: string) => backupRepo.getCompanyById(companyId),
};