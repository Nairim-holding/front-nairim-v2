import { mongoAuditLogsRepository } from '@/infra/repositories/mongo-audit-logs-repository';
import { ListAuditLogsUseCase, GetAuditLogByIdUseCase, GetAuditLogFiltersUseCase } from '@/core/use-cases/audit-log/queries';

/** Composition root do módulo Auditoria (Logs). Camada: infra. */
export const auditLogUseCases = {
  list: new ListAuditLogsUseCase(mongoAuditLogsRepository),
  getById: new GetAuditLogByIdUseCase(mongoAuditLogsRepository),
  getFilters: new GetAuditLogFiltersUseCase(mongoAuditLogsRepository),
};
