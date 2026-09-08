'use server';

import { type ActionResult, runAction } from '@/shared/actions/action-result';
import { iptuAuditUseCases } from '@/infra/factories/iptu-audit-factory';
import { withPermission, withPermissionInput } from '@/infra/auth/session';
import { iptuAuditSettingsSchema } from '@/shared/validators/iptu-audit';
import type { IptuAuditReport, IptuAuditSettings } from '@/core/entities/iptu-audit';
import { getIptuAuditSettingsData, getIptuAuditData } from '@/server/queries/iptu-audit';

/**
 * Server Actions do módulo Auditoria de IPTU. Substituem os endpoints de
 * `/financial-audit`. Guarda: `withPermission('financial-audit', 'view'|'edit')`.
 * Camada: server. Origem: AuditController.ts.
 */

/** Salva a configuração de categorias comparadas. Origem: PUT /financial-audit/iptu/settings. */
export async function saveIptuAuditSettingsAction(input: Record<string, unknown>): Promise<ActionResult<IptuAuditSettings>> {
  return runAction(async () => {
    const data = iptuAuditSettingsSchema.parse(input);
    return withPermissionInput('financial-audit', 'edit', input, (session) => iptuAuditUseCases.saveSettings.execute(session.company_id, data));
  });
}

// ─── Leituras expostas como action (para Client Components) ─────────────────

export async function getIptuAuditSettingsAction(): Promise<ActionResult<IptuAuditSettings | null>> {
  return runAction(() => getIptuAuditSettingsData());
}

export async function getIptuAuditAction(raw: Record<string, unknown>): Promise<ActionResult<IptuAuditReport>> {
  return runAction(() => getIptuAuditData(raw));
}
