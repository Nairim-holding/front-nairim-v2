import { prismaAuditLogsRepository } from '@/infra/repositories/prisma-audit-logs-repository';
import { ListAuditLogsUseCase, GetAuditLogByIdUseCase, GetAuditLogFiltersUseCase } from '@/core/use-cases/audit-log/queries';

/** Composition root do módulo Auditoria (Logs). Camada: infra. */
export const auditLogUseCases = {
  list: new ListAuditLogsUseCase(prismaAuditLogsRepository),
  getById: new GetAuditLogByIdUseCase(prismaAuditLogsRepository),
  getFilters: new GetAuditLogFiltersUseCase(prismaAuditLogsRepository),
};
