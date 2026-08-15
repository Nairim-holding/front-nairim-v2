'use server';

import { userPreferencesUseCases } from '@/infra/factories/user-factory';
import { saveColumnPreferencesSchema, saveDashboardLayoutSchema } from '@/shared/validators/user-preferences';
import { type ActionResult, runAction } from '@/shared/actions/action-result';
import { withTenant } from '@/infra/auth/session';
import type { ColumnPreferences, DashboardLayout } from '@/core/entities/user-preferences';
import {
  getColumnPreferencesData,
  getDashboardLayoutData,
  EMPTY_COLUMN_PREFERENCES,
} from '@/server/queries/user-preferences';

/**
 * Server Actions das preferências de UI do usuário logado.
 * Substituem `/user-preferences/column-order` e `/dashboard-layout`.
 *
 * As preferências são SEMPRE do usuário da sessão (o backend também usava
 * `req.user.id`, nunca um id vindo do cliente).
 *
 * Camada: server (apresentação SSR).
 * Origem: api-nairim-v2/src/controllers/UserPreferencesController.ts.
 */

/**
 * Lê as preferências de coluna. Quando não existem, devolve o mesmo default do
 * backend (arrays vazios) em vez de erro — o front trata como "sem preferência".
 * Origem: GET /user-preferences/column-order.
 */
export async function getColumnPreferencesAction(
  resource: string,
): Promise<ActionResult<ColumnPreferences | typeof EMPTY_COLUMN_PREFERENCES>> {
  return runAction(async () => (await getColumnPreferencesData(resource)) ?? EMPTY_COLUMN_PREFERENCES);
}

/** Salva as preferências de coluna. Origem: POST /user-preferences/column-order. */
export async function saveColumnPreferencesAction(
  input: Record<string, unknown>,
): Promise<ActionResult<ColumnPreferences>> {
  return runAction(async () => {
    const data = saveColumnPreferencesSchema.parse(input);
    return withTenant((session) => userPreferencesUseCases.saveColumnPreferences.execute(session.id, data));
  });
}

/**
 * Lê o layout do dashboard. Sem layout salvo, devolve `{ layout: [] }` (default
 * do backend). Origem: GET /user-preferences/dashboard-layout.
 */
export async function getDashboardLayoutAction(
  resource: string,
): Promise<ActionResult<DashboardLayout | { layout: [] }>> {
  return runAction(async () => (await getDashboardLayoutData(resource)) ?? { layout: [] as [] });
}

/** Salva o layout do dashboard. Origem: POST /user-preferences/dashboard-layout. */
export async function saveDashboardLayoutAction(
  input: Record<string, unknown>,
): Promise<ActionResult<DashboardLayout>> {
  return runAction(async () => {
    const data = saveDashboardLayoutSchema.parse(input);
    return withTenant((session) => userPreferencesUseCases.saveDashboardLayout.execute(session.id, data));
  });
}
