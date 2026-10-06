import 'server-only';
import { leaseReportsRepository } from '@/infra/factories/lease-report-factory';
import { withPermission } from '@/infra/auth/session';
import { withReportingScope } from '@/infra/auth/reporting-scope';
import { leaseReportParamsSchema } from '@/shared/validators/lease-report';
import type { LeaseReportResult } from '@/core/entities/lease-report';

/**
 * Query (leitura) do Relatório de Locações — menu Locações > Relatórios.
 * Guarda: `withPermission('lease-reports', 'view')`.
 *
 * Só leitura: o relatório é gerado sob demanda a partir das locações e dos
 * lançamentos já existentes; nada é persistido, e a exportação
 * (PDF/Excel/impressão) roda 100% no front, igual aos Relatórios Financeiros.
 *
 * Camada: server.
 */
export async function getLeaseReportData(raw: Record<string, unknown>): Promise<LeaseReportResult> {
  const params = leaseReportParamsSchema.parse(raw);
  return withPermission('lease-reports', 'view', session => withReportingScope(session, raw, () => leaseReportsRepository.getLeaseReport(params)));
}
