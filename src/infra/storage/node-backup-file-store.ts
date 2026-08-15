import fs from 'node:fs';
import path from 'node:path';
import type { BackupFileStore } from '@/core/storage/backup-file-store';
import type { AutoBackupInfo, BackupPayload } from '@/core/entities/backup';
import { autoBackupPrefix, buildAutoBackupFilename } from '@/core/utils/backup-filename';

/**
 * Armazenamento em disco dos auto-backups (pasta `backup/` na raiz do servidor).
 * Porte fiel do `AUTO_BACKUP_DIR`/`fs.*` de api-nairim-v2/src/services/BackupService.ts.
 *
 * Segurança (idêntico ao `resolveAutoBackupPath`): o nome do arquivo é sempre
 * validado contra separadores de path e prefixo da empresa antes de acessar o
 * disco — evita path traversal e acesso a backups de outras empresas.
 *
 * Camada: infra.
 */
export class NodeBackupFileStore implements BackupFileStore {
  constructor(private readonly AUTO_BACKUP_DIR: string = path.join(process.cwd(), 'backup')) {}

  writeAutoBackup(companySlug: string, payload: BackupPayload): string {
    const filename = buildAutoBackupFilename(companySlug, new Date());
    fs.mkdirSync(this.AUTO_BACKUP_DIR, { recursive: true });
    const full = path.join(this.AUTO_BACKUP_DIR, filename);
    fs.writeFileSync(full, JSON.stringify(payload), 'utf-8');
    return filename;
  }

  listAutoBackups(companySlug: string): AutoBackupInfo[] {
    if (!fs.existsSync(this.AUTO_BACKUP_DIR)) return [];

    const prefix = autoBackupPrefix(companySlug);
    return fs
      .readdirSync(this.AUTO_BACKUP_DIR)
      .filter((name) => name.startsWith(prefix) && name.endsWith('.json'))
      .map((name) => {
        const stat = fs.statSync(path.join(this.AUTO_BACKUP_DIR, name));
        return { name, size: stat.size, createdAt: stat.mtime.toISOString() };
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  readAutoBackup(companySlug: string, filename: string): string | null {
    // Segurança: sem separadores de caminho e com o prefixo da empresa.
    const safe = path.basename(filename);
    if (safe !== filename) return null;
    if (!safe.startsWith(autoBackupPrefix(companySlug)) || !safe.endsWith('.json')) return null;

    const full = path.join(this.AUTO_BACKUP_DIR, safe);
    if (!fs.existsSync(full)) return null;
    return fs.readFileSync(full, 'utf-8');
  }
}