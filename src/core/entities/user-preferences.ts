/**
 * Entidades de domínio: preferências de UI do usuário.
 *
 * Camada: core.
 * Origem: models `UserColumnPreference` / `UserDashboardLayout`
 * (prisma/schema.prisma) e api-nairim-v2/src/types/user-preferences.ts.
 */

/** Preferências de coluna de um DataTable, por recurso. */
export interface ColumnPreferences {
  id: string;
  user_id: string;
  resource: string;
  columnOrder: string[];
  columnWidths: Record<string, number>;
  visibleColumns: string[];
  /** ISO string (formato devolvido ao front, igual ao backend). */
  created_at: string;
  updated_at: string;
}

/** Entrada para salvar preferências de coluna. */
export interface SaveColumnPreferencesInput {
  resource: string;
  columnOrder: string[];
  columnWidths: Record<string, number>;
  visibleColumns?: string[];
}

/** Item de layout do dashboard (react-grid-layout). */
export interface DashboardLayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  [key: string]: unknown;
}

/** Layout do dashboard de um recurso. */
export interface DashboardLayout {
  id: string;
  user_id: string;
  resource: string;
  layout: DashboardLayoutItem[];
  created_at: string;
  updated_at: string;
}

/** Entrada para salvar o layout do dashboard. */
export interface SaveDashboardLayoutInput {
  resource: string;
  layout: DashboardLayoutItem[];
}
