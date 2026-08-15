import type {
  ColumnPreferences,
  DashboardLayout,
  SaveColumnPreferencesInput,
  SaveDashboardLayoutInput,
} from '@/core/entities/user-preferences';

/**
 * Contrato de acesso às preferências de UI do usuário.
 *
 * Implementação Prisma: infra/repositories/prisma-user-preferences-repository.ts.
 *
 * Camada: core.
 * Origem: api-nairim-v2/src/services/UserPreferencesService.ts.
 */
export interface UserPreferencesRepository {
  /** Preferências de coluna do usuário para um recurso, ou `null`. */
  getColumnPreferences(userId: string, resource: string): Promise<ColumnPreferences | null>;

  /** Cria/atualiza (upsert por user_id+resource) as preferências de coluna. */
  saveColumnPreferences(userId: string, input: SaveColumnPreferencesInput): Promise<ColumnPreferences>;

  /** Layout do dashboard do usuário para um recurso, ou `null`. */
  getDashboardLayout(userId: string, resource: string): Promise<DashboardLayout | null>;

  /** Cria/atualiza (upsert por user_id+resource) o layout do dashboard. */
  saveDashboardLayout(userId: string, input: SaveDashboardLayoutInput): Promise<DashboardLayout>;
}
