import type {
  AuditFiltersResponse,
  AuditLogDetail,
  GetAuditLogsParams,
  PaginatedAuditLogs,
} from '@/core/entities/audit-log';

/**
 * Contrato de leitura de Logs de Auditoria — read-only (log é gerado pelo
 * sistema, não há criar/editar/excluir).
 * Implementação MongoDB: infra/repositories/mongo-audit-logs-repository.ts.
 * Todas as operações exigem contexto de empresa.
 *
 * Camada: core.
 * Origem: api-nairim-v2/src/services/AuditLogService.ts.
 */
export interface AuditLogsRepository {
  list(params: GetAuditLogsParams): Promise<PaginatedAuditLogs>;
  findById(id: string): Promise<AuditLogDetail | null>;
  getFilters(filters: Record<string, unknown>): Promise<AuditFiltersResponse>;
}
