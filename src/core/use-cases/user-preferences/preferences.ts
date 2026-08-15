import type { UserPreferencesRepository } from '@/core/repositories/user-preferences-repository';
import type {
  ColumnPreferences,
  DashboardLayout,
  SaveColumnPreferencesInput,
  SaveDashboardLayoutInput,
} from '@/core/entities/user-preferences';

/**
 * Casos de uso de preferências de UI do usuário.
 * Camada: core.
 * Origem: api-nairim-v2/src/services/UserPreferencesService.ts + UserPreferencesController.ts.
 *
 * Nota: quando não há preferência salva, o backend respondia 404 com um payload
 * padrão (arrays vazios). Aqui os use-cases retornam `null` e a camada de
 * apresentação devolve o mesmo default — sem semântica de erro HTTP no core.
 */

/** Preferências de coluna do usuário para um recurso. Origem: getColumnOrder. */
export class GetColumnPreferencesUseCase {
  constructor(private readonly repo: UserPreferencesRepository) {}
  async execute(userId: string, resource: string): Promise<ColumnPreferences | null> {
    return this.repo.getColumnPreferences(userId, resource);
  }
}

/** Salva as preferências de coluna. Origem: saveColumnOrder. */
export class SaveColumnPreferencesUseCase {
  constructor(private readonly repo: UserPreferencesRepository) {}
  async execute(userId: string, input: SaveColumnPreferencesInput): Promise<ColumnPreferences> {
    return this.repo.saveColumnPreferences(userId, input);
  }
}

/** Layout do dashboard do usuário. Origem: getDashboardLayout. */
export class GetDashboardLayoutUseCase {
  constructor(private readonly repo: UserPreferencesRepository) {}
  async execute(userId: string, resource: string): Promise<DashboardLayout | null> {
    return this.repo.getDashboardLayout(userId, resource);
  }
}

/** Salva o layout do dashboard. Origem: saveDashboardLayout. */
export class SaveDashboardLayoutUseCase {
  constructor(private readonly repo: UserPreferencesRepository) {}
  async execute(userId: string, input: SaveDashboardLayoutInput): Promise<DashboardLayout> {
    return this.repo.saveDashboardLayout(userId, input);
  }
}
