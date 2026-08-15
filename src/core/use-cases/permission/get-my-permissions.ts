import type { UserGroupPermissionsRepository } from '@/core/repositories/user-group-permissions-repository';
import type { ResolvedPermissionsResponse } from '@/core/entities/user-group-permission';
import { MENU_RESOURCES } from '@/shared/utils/menu-resources';

/**
 * Auto-serviço: "quais são as MINHAS permissões efetivas". Usado pelo front
 * para filtrar menu/ícones de ação — não para autorizar (isso é
 * `withPermission` em cada action/query). Por isso não recebe guard de
 * recurso: todo usuário autenticado pode ler as próprias permissões.
 *
 * Camada: core.
 * Origem: api-nairim-v2/src/controllers/PermissionsController.ts.
 */
export class GetMyPermissionsUseCase {
  constructor(private readonly repo: UserGroupPermissionsRepository) {}

  async execute(userId: string, role: string): Promise<ResolvedPermissionsResponse> {
    // Mesmo critério do guard requirePermission: só SUPER_ADMIN é irrestrito
    // por papel. ADMIN sem grupo também é irrestrito, mas isso vem do
    // resolveForUser (perms === null), não de um bypass de role aqui.
    if (role === 'SUPER_ADMIN') {
      return { unrestricted: true, resources: {} };
    }

    const perms = await this.repo.resolveForUser(userId);
    if (perms === null) {
      return { unrestricted: true, resources: {} };
    }

    const resources: Record<string, Record<string, boolean>> = {};
    for (const resource of MENU_RESOURCES) {
      const granted = perms.get(resource.key);
      const row: Record<string, boolean> = {};
      for (const action of resource.actions) {
        row[action] = granted?.has(action) ?? false;
      }
      resources[resource.key] = row;
    }

    return { unrestricted: false, resources };
  }
}
