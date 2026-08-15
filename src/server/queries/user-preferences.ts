import 'server-only';
import { userPreferencesUseCases } from '@/infra/factories/user-factory';
import { withTenant } from '@/infra/auth/session';
import { getColumnPreferencesSchema, getDashboardLayoutSchema } from '@/shared/validators/user-preferences';
import type { ColumnPreferences, DashboardLayout } from '@/core/entities/user-preferences';

/**
 * Queries (leitura) das preferências de UI do usuário logado.
 * Substituem `GET /user-preferences/column-order` e `/dashboard-layout`.
 *
 * Camada: server (apresentação SSR).
 * Origem: api-nairim-v2/src/controllers/UserPreferencesController.ts (GETs).
 */

/** Default devolvido quando não há preferência salva (o backend respondia 404 + este payload). */
export const EMPTY_COLUMN_PREFERENCES = {
  columnOrder: [] as string[],
  columnWidths: {} as Record<string, number>,
  visibleColumns: [] as string[],
};

/** Preferências de coluna do usuário logado (ou `null` se não houver). */
export async function getColumnPreferencesData(resource: string): Promise<ColumnPreferences | null> {
  const parsed = getColumnPreferencesSchema.parse({ resource });
  return withTenant((session) => userPreferencesUseCases.getColumnPreferences.execute(session.id, parsed.resource));
}

/** Layout do dashboard do usuário logado (ou `null` se não houver). */
export async function getDashboardLayoutData(resource: string): Promise<DashboardLayout | null> {
  const parsed = getDashboardLayoutSchema.parse({ resource });
  return withTenant((session) => userPreferencesUseCases.getDashboardLayout.execute(session.id, parsed.resource));
}
