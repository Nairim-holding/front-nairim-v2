'use server';

import { type ActionResult, runAction } from '@/shared/actions/action-result';
import type { LeaseReportResult } from '@/core/entities/lease-report';
import { getLeaseReportData } from '@/server/queries/lease-report';

/**
 * Server Action do Relatório de Locações (menu Locações > Relatórios).
 * Guarda: `withPermission('lease-reports', 'view')`, aplicada na query.
 * Camada: server.
 */
export async function getLeaseReportAction(raw: Record<string, unknown>): Promise<ActionResult<LeaseReportResult>> {
  return runAction(() => getLeaseReportData(raw));
}
