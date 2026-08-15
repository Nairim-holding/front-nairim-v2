import type {
  AuditFiltersResponse,
  AuditLogDetail,
  GetAuditLogsParams,
  PaginatedAuditLogs,
} from '@/core/entities/audit-log';

/**
 * Contrato de leitura de Logs de Auditoria — read-only (log é gerado pelo
 * sistema, não há criar/editar/excluir).
 * Implementação Prisma: infra/repositories/prisma-audit-logs-repository.ts.
 * Tenant-scoped: `AuditLog` está em TENANT_MODELS.
 *
 * Camada: core.
 * Origem: api-nairim-v2/src/services/AuditLogService.ts.
 */
export interface AuditLogsRepository {
  list(params: GetAuditLogsParams): Promise<PaginatedAuditLogs>;
  findById(id: string): Promise<AuditLogDetail | null>;
  getFilters(filters: Record<string, unknown>): Promise<AuditFiltersResponse>;
}
