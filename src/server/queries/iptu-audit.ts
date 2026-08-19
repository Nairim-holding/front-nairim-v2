import 'server-only';
import { iptuAuditUseCases } from '@/infra/factories/iptu-audit-factory';
import { withPermission } from '@/infra/auth/session';
import { iptuAuditQuerySchema } from '@/shared/validators/iptu-audit';
import type { IptuAuditReport, IptuAuditSettings } from '@/core/entities/iptu-audit';

/**
 * Queries (leitura) do módulo Auditoria de IPTU — para Client Components.
 * Guarda: `withPermission('financial-audit', 'view')`.
 * Camada: server. Origem: AuditController.ts (GETs).
 */

export async function getIptuAuditSettingsData(): Promise<IptuAuditSettings | null> {
  return withPermission('financial-audit', 'view', (session) => iptuAuditUseCases.getSettings.execute(session.company_id));
}

export async function getIptuAuditData(raw: Record<string, unknown>): Promise<IptuAuditReport> {
  const { startDate, endDate, propertyIds } = iptuAuditQuerySchema.parse(raw);
  return withPermission('financial-audit', 'view', (session) =>
    iptuAuditUseCases.getAudit.execute({ startDate, endDate, propertyIds }, session.company_id),
  );
}
