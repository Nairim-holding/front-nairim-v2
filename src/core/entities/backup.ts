/**
 * Entidades e constantes do módulo Backup (export/restore por empresa).
 *
 * Origem: api-nairim-v2/src/services/BackupService.ts.
 * O backup serializa TODOS os registros com `company_id` da empresa + os filhos
 * vinculados por relação. Mídias não entram — apenas as URLs em Document.file_path.
 *
 * Camada: core.
 */

/** Versão do formato do arquivo de backup (incremente em mudanças incompatíveis). */
export const BACKUP_FORMAT_VERSION = 1;

/** Metadados do cabeçalho do arquivo (chave `meta`). */
export interface BackupMeta {
  app: 'nairim';
  formatVersion: number;
  company_id: string;
  company_name: string;
  company_slug: string;
  exportedAt: string;
  /** SHA-256 (hex) de `JSON.stringify(data)`. */
  checksum: string;
  /** Contagem de itens por chave de `data`. */
  counts: Record<string, number>;
}

/** Serialização completa dos dados de uma empresa. */
export interface BackupPayload {
  meta: BackupMeta;
  data: Record<string, unknown[]>;
}

/** Backup automático (pré-restore) gravado em disco. */
export interface AutoBackupInfo {
  name: string;
  size: number;
  createdAt: string;
}

/** Resultado de um restore bem-sucedido. */
export interface RestoreOutcome {
  success: true;
  company_id: string;
  company_name: string;
  message: string;
  autoBackupName: string;
}