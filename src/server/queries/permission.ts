import 'server-only';
import { permissionUseCases } from '@/infra/factories/permission-factory';
import { withTenant } from '@/infra/auth/session';
import type { ResolvedPermissionsResponse } from '@/core/entities/user-group-permission';

/**
 * Query (leitura) do módulo Permissions — para Client Components.
 * Guarda: `withTenant` (sem checagem de recurso — auto-serviço, todo usuário
 * autenticado pode ler as próprias permissões).
 * Camada: server. Origem: PermissionsController.ts.
 */
export async function getMyPermissionsData(): Promise<ResolvedPermissionsResponse> {
  return withTenant((session) => permissionUseCases.getMy.execute(session.id, session.role));
}
