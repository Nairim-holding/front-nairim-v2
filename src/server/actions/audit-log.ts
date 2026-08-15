'use server';

import { type ActionResult, runAction } from '@/shared/actions/action-result';
import type { AuditFiltersResponse, AuditLogDetail, PaginatedAuditLogs } from '@/core/entities/audit-log';
import { listAuditLogsData, getAuditLogByIdData, getAuditLogFiltersData } from '@/server/queries/audit-log';

/**
 * Server Actions do módulo Auditoria (Logs). Substituem os endpoints de
 * `/audit-logs`. Guarda: `withPermission('audit-logs', 'view')`.
 * Camada: server. Origem: AuditLogController.ts.
 *
 * Só leituras — log é gerado pelo sistema, não há criar/editar/excluir.
 */

export async function listAuditLogsAction(raw: Record<string, unknown>): Promise<ActionResult<PaginatedAuditLogs>> {
  return runAction(() => listAuditLogsData(raw));
}

export async function getAuditLogByIdAction(id: string): Promise<ActionResult<AuditLogDetail>> {
  return runAction(() => getAuditLogByIdData(id));
}

export async function getAuditLogFiltersAction(raw: Record<string, unknown>): Promise<ActionResult<AuditFiltersResponse>> {
  return runAction(() => getAuditLogFiltersData(raw));
}
