import 'server-only';
import { withPermission } from '@/infra/auth/session';
import { prismaPropertyRoiRepository } from '@/infra/repositories/prisma-property-roi-repository';
import { roiReportQuerySchema } from '@/shared/validators/property-roi';
import type { RoiReport, RoiSettingsView } from '@/core/entities/property-roi';

/**
 * Queries (leitura) do ROI por imóvel — para Client Components.
 * Guarda: `withPermission('financial-audit', 'view')`, a mesma diretiva da
 * Auditoria de IPTU (os dois ficam no menu Auditoria).
 * Camada: server.
 */

function todayInSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export async function getRoiSettingsData(): Promise<RoiSettingsView> {
  return withPermission('financial-audit', 'view', (session) => prismaPropertyRoiRepository.getSettings(session.company_id));
}

export async function getRoiReportData(raw: Record<string, unknown>): Promise<RoiReport> {
  const { from, to, propertyIds } = roiReportQuerySchema.parse(raw);
  return withPermission('financial-audit', 'view', (session) =>
    prismaPropertyRoiRepository.getReport({ from, to, propertyIds, today: todayInSaoPaulo() }, session.company_id),
  );
}
