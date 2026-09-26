import { getCurrentCompanyId } from '@/infra/database/tenant-context';
import prisma from '@/infra/database/prisma';
import type { UserPreferencesRepository } from '@/core/repositories/user-preferences-repository';
import type {
  ColumnPreferences,
  DashboardLayout,
  DashboardLayoutItem,
  SaveColumnPreferencesInput,
  SaveDashboardLayoutInput,
} from '@/core/entities/user-preferences';

/**
 * Implementação Prisma de {@link UserPreferencesRepository}.
 *
 * `UserColumnPreference` e `UserDashboardLayout` são tenant-scoped: rodam dentro
 * de `withTenant`, então o `company_id` é injetado automaticamente no create pela
 * extensão do Prisma (o backend o passava explicitamente).
 *
 * As datas são devolvidas como ISO string, igual ao backend.
 *
 * Camada: infra.
 * Origem: api-nairim-v2/src/services/UserPreferencesService.ts.
 */
function companyId(): string {
  const id = getCurrentCompanyId();
  if (!id) throw new Error('Contexto de empresa não identificado.');
  return id;
}

export class PrismaUserPreferencesRepository implements UserPreferencesRepository {
  /** @inheritdoc */
  async getColumnPreferences(userId: string, resource: string): Promise<ColumnPreferences | null> {
    const prefs = await prisma.userColumnPreference.findUnique({
      where: { company_id_user_id_resource: { company_id: companyId(), user_id: userId, resource } },
    });
    if (!prefs) return null;
    return {
      id: prefs.id,
      user_id: prefs.user_id,
      resource: prefs.resource,
      columnOrder: (prefs.column_order as string[]) || [],
      columnWidths: (prefs.column_widths as Record<string, number>) || {},
      visibleColumns: (prefs.visible_columns as string[]) || [],
      created_at: prefs.created_at.toISOString(),
      updated_at: prefs.updated_at.toISOString(),
    };
  }

  /** @inheritdoc */
  async saveColumnPreferences(userId: string, input: SaveColumnPreferencesInput): Promise<ColumnPreferences> {
    // `upsert` (não findUnique+create/update) evita uma corrida em que duas
    // gravações quase simultâneas do mesmo resource ambas veem "não existe" e
    // ambas tentam `create`, estourando a unique constraint
    // (company_id, user_id, resource).
    const prefs = await prisma.userColumnPreference.upsert({
      where: { company_id_user_id_resource: { company_id: companyId(), user_id: userId, resource: input.resource } },
      update: {
        column_order: input.columnOrder,
        column_widths: input.columnWidths,
        visible_columns: input.visibleColumns,
        updated_at: new Date(),
      } as never,
      create: {
        user_id: userId,
        resource: input.resource,
        column_order: input.columnOrder,
        column_widths: input.columnWidths,
        visible_columns: input.visibleColumns,
      } as never,
    });

    return {
      id: prefs.id,
      user_id: prefs.user_id,
      resource: prefs.resource,
      columnOrder: (prefs.column_order as string[]) || [],
      columnWidths: (prefs.column_widths as Record<string, number>) || {},
      visibleColumns: (prefs.visible_columns as string[]) || [],
      created_at: prefs.created_at.toISOString(),
      updated_at: prefs.updated_at.toISOString(),
    };
  }

  /** @inheritdoc */
  async getDashboardLayout(userId: string, resource: string): Promise<DashboardLayout | null> {
    const layout = await prisma.userDashboardLayout.findUnique({
      where: { company_id_user_id_resource: { company_id: companyId(), user_id: userId, resource } },
    });
    if (!layout) return null;
    return {
      id: layout.id,
      user_id: layout.user_id,
      resource: layout.resource,
      layout: (layout.layout as unknown as DashboardLayoutItem[]) || [],
      created_at: layout.created_at.toISOString(),
      updated_at: layout.updated_at.toISOString(),
    };
  }

  /** @inheritdoc */
  async saveDashboardLayout(userId: string, input: SaveDashboardLayoutInput): Promise<DashboardLayout> {
    // `upsert` (não findUnique+create/update) evita uma corrida em que duas
    // gravações quase simultâneas do mesmo resource (ex.: dois widgets
    // movidos em sequência rápida) ambas veem "não existe" e ambas tentam
    // `create`, estourando a unique constraint (company_id, user_id, resource)
    // — era essa corrida que gerava o toast "Erro ao salvar o layout do
    // painel" após as 3 tentativas de retry (a nova tentativa de `create`
    // falhava de novo, pois o registro já existia).
    const layout = await prisma.userDashboardLayout.upsert({
      where: { company_id_user_id_resource: { company_id: companyId(), user_id: userId, resource: input.resource } },
      update: { layout: input.layout as never, updated_at: new Date() },
      create: { user_id: userId, resource: input.resource, layout: input.layout as never } as never,
    });

    return {
      id: layout.id,
      user_id: layout.user_id,
      resource: layout.resource,
      layout: (layout.layout as unknown as DashboardLayoutItem[]) || [],
      created_at: layout.created_at.toISOString(),
      updated_at: layout.updated_at.toISOString(),
    };
  }
}
