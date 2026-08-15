import type { AuditLogsRepository } from '@/core/repositories/audit-logs-repository';
import type {
  AuditFiltersResponse,
  AuditLogDetail,
  GetAuditLogsParams,
  PaginatedAuditLogs,
} from '@/core/entities/audit-log';
import { NotFoundError, ValidationError } from '@/core/errors/domain-errors';

/**
 * Casos de uso de Log de Auditoria — só leitura (log é gerado pelo sistema,
 * sem create/update/delete; por isso "queries", não "crud").
 *
 * Camada: core.
 * Origem: api-nairim-v2/src/controllers/AuditLogController.ts.
 */

export class ListAuditLogsUseCase {
  constructor(private readonly repo: AuditLogsRepository) {}
  async execute(params: GetAuditLogsParams): Promise<PaginatedAuditLogs> {
    return this.repo.list(params);
  }
}

export class GetAuditLogByIdUseCase {
  constructor(private readonly repo: AuditLogsRepository) {}
  async execute(id: string): Promise<AuditLogDetail> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    const log = await this.repo.findById(id);
    if (!log) throw new NotFoundError('Log não encontrado');
    return log;
  }
}

export class GetAuditLogFiltersUseCase {
  constructor(private readonly repo: AuditLogsRepository) {}
  async execute(filters: Record<string, unknown>): Promise<AuditFiltersResponse> {
    return this.repo.getFilters(filters);
  }
}
