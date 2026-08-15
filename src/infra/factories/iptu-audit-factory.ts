import { prismaIptuAuditRepository } from '@/infra/repositories/prisma-iptu-audit-repository';
import { GetIptuAuditSettingsUseCase, SaveIptuAuditSettingsUseCase } from '@/core/use-cases/iptu-audit/settings';
import { GetIptuAuditUseCase } from '@/core/use-cases/iptu-audit/report';

/** Composition root do módulo Auditoria de IPTU. Camada: infra. */
export const iptuAuditUseCases = {
  getSettings: new GetIptuAuditSettingsUseCase(prismaIptuAuditRepository),
  saveSettings: new SaveIptuAuditSettingsUseCase(prismaIptuAuditRepository),
  getAudit: new GetIptuAuditUseCase(prismaIptuAuditRepository),
};
