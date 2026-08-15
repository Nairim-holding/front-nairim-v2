import { createHash } from 'node:crypto';

/**
 * Helpers puros do módulo Backup (checksum e nomes de arquivos).
 * Fontes fiéis:
 *  - checksum = SHA-256 de `JSON.stringify(data)` (BackupService).
 *  - nome do auto-backup = `backup-nairim-<slug>-auto-<ISO sem ':'>.json`.
 *
 * Mantidos em `core` para serem testáveis e reutilizáveis no infra (disco)
 * e no use-case (validação).
 * Camada: core.
 */

/** SHA-256 hex de `JSON.stringify(data)` — idêntico ao backend. */
export function buildChecksum(data: unknown): string {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

/** Data no formato do backend: `YYYY-MM-DDTHH-mm-ss` (ISO sem ':' e sem ms). */
export function toAutoBackupStamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace(/:/g, '-');
}

/** Nome do arquivo de auto-backup: `backup-nairim-<slug>-auto-<stamp>.json`. */
export function buildAutoBackupFilename(slug: string, date: Date): string {
  return `backup-nairim-${slug}-auto-${toAutoBackupStamp(date)}.json`;
}

/** Nome do download manual: `backup-nairim-<slug>-<YYYY-MM-DD>.json`. */
export function buildManualBackupFilename(slug: string, date: Date): string {
  return `backup-nairim-${slug}-${date.toISOString().slice(0, 10)}.json`;
}

/** Prefixo usado para filtrar backups automáticos de uma empresa. */
export function autoBackupPrefix(slug: string): string {
  return `backup-nairim-${slug}-auto-`;
}