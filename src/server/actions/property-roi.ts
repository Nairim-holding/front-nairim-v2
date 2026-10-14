'use server';

import { type ActionResult, runAction } from '@/shared/actions/action-result';
import { withPermission } from '@/infra/auth/session';
import { prismaPropertyRoiRepository } from '@/infra/repositories/prisma-property-roi-repository';
import { roiSettingsSchema } from '@/shared/validators/property-roi';
import { getRoiReportData, getRoiSettingsData } from '@/server/queries/property-roi';
import type { RoiReport, RoiSettingsView } from '@/core/entities/property-roi';

/**
 * Server Actions do ROI por imóvel.
 * Guarda: `withPermission('financial-audit', 'view'|'edit')`.
 * Camada: server.
 */

/** Salva qual categoria/subcategoria alimenta cada linha do cálculo. */
export async function saveRoiSettingsAction(input: Record<string, unknown>): Promise<ActionResult<RoiSettingsView>> {
  return runAction(async () => {
    const { lines } = roiSettingsSchema.parse(input);
    // O repositório confere que cada categoria/subcategoria é da própria empresa.
    return withPermission('financial-audit', 'edit', (session) => prismaPropertyRoiRepository.saveSettings(session.company_id, lines));
  });
}

// ─── Leituras expostas como action (para Client Components) ─────────────────

export async function getRoiSettingsAction(): Promise<ActionResult<RoiSettingsView>> {
  return runAction(() => getRoiSettingsData());
}

export async function getRoiReportAction(raw: Record<string, unknown>): Promise<ActionResult<RoiReport>> {
  return runAction(() => getRoiReportData(raw));
}
