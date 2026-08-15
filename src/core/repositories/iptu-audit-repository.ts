import type {
  IptuAuditParams,
  IptuAuditReport,
  IptuAuditSettings,
  IptuAuditSettingsInput,
} from '@/core/entities/iptu-audit';

/**
 * Contrato de acesso a dados da Auditoria de IPTU.
 * Implementação Prisma: infra/repositories/prisma-iptu-audit-repository.ts.
 * Tenant-scoped: `IptuAuditSettings` está em TENANT_MODELS.
 *
 * Camada: core.
 * Origem: api-nairim-v2/src/services/AuditService.ts.
 */
export interface IptuAuditRepository {
  getSettings(companyId: string): Promise<IptuAuditSettings | null>;

  /** Upsert por company_id — config única por empresa, sem histórico. */
  saveSettings(companyId: string, input: IptuAuditSettingsInput): Promise<IptuAuditSettings>;

  /**
   * Gera o relatório comparando receita x despesa por imóvel no período.
   * Lança se as categorias não estiverem configuradas (nenhum dos dois lados).
   */
  getAudit(params: IptuAuditParams, companyId: string): Promise<IptuAuditReport>;
}
