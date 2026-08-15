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
export class PrismaUserPreferencesRepository implements UserPreferencesRepository {
  /** @inheritdoc */
  async getColumnPreferences(userId: string, resource: string): Promise<ColumnPreferences | null> {
    const prefs = await prisma.userColumnPreference.findUnique({
      where: { user_id_resource: { user_id: userId, resource } },
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
    const existing = await prisma.userColumnPreference.findUnique({
      where: { user_id_resource: { user_id: userId, resource: input.resource } },
    });

    const prefs = existing
      ? await prisma.userColumnPreference.update({
          where: { id: existing.id },
          data: {
            column_order: input.columnOrder,
            column_widths: input.columnWidths,
            visible_columns: input.visibleColumns,
            updated_at: new Date(),
          } as never,
        })
      : await prisma.userColumnPreference.create({
          data: {
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
      where: { user_id_resource: { user_id: userId, resource } },
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
    const existing = await prisma.userDashboardLayout.findUnique({
      where: { user_id_resource: { user_id: userId, resource: input.resource } },
    });

    const layout = existing
      ? await prisma.userDashboardLayout.update({
          where: { id: existing.id },
          data: { layout: input.layout as never, updated_at: new Date() },
        })
      : await prisma.userDashboardLayout.create({
          data: { user_id: userId, resource: input.resource, layout: input.layout as never } as never,
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
