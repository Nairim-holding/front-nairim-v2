import type { AutoBackupInfo, BackupPayload } from '@/core/entities/backup';

/**
 * Contrato de armazenamento em disco dos backups automáticos (pré-restore).
 *
 * Implementação Node (fs): infra/storage/node-backup-file-store.ts.
 * Camada: core.
 * Origem: `fs.*` sobre `AUTO_BACKUP_DIR` em api-nairim-v2/src/services/BackupService.ts.
 */
export interface BackupFileStore {
  /** Grava o payload como JSON na pasta de auto-backups e devolve o nome. */
  writeAutoBackup(companySlug: string, payload: BackupPayload): string;

  /** Lista os auto-backups da empresa (mais recente primeiro). */
  listAutoBackups(companySlug: string): AutoBackupInfo[];

  /**
   * Lê o conteúdo JSON de um auto-backup da empresa, validando o nome
   * (path traversal / empresa errada). `null` se não existir/válido.
   */
  readAutoBackup(companySlug: string, filename: string): string | null;
}