import type { BackupPayload } from '@/core/entities/backup';

/**
 * Contrato de acesso a dados do Backup por empresa.
 *
 * Implementação Prisma: infra/repositories/prisma-backup-repository.ts.
 * Camada: core.
 * Origem: api-nairim-v2/src/services/BackupService.ts (exportCompany e a
 * transação destrutiva do restoreCompany).
 */
export interface BackupRepository {
  /** Empresa pelo ID (para validação de confirmação e nomes). */
  getCompanyById(companyId: string): Promise<{ id: string; name: string; slug: string } | null>;

  /** Exporta todos os dados da empresa em ordem FK-safe (pais antes de filhos). */
  exportCompany(companyId: string): Promise<BackupPayload>;

  /**
   * Deleta todos os dados da empresa (ordem FK-safe, filhos antes de pais) e
   * reinsere os do backup (ordem FK-safe, pais antes de filhos), tudo em uma
   * transação Prisma. Usuários são preservados (upsert). ⚠️ Destrutivo.
   */
  restoreCompany(companyId: string, backupData: BackupPayload): Promise<void>;
}