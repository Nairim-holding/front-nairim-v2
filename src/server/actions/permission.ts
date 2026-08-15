'use server';

import { type ActionResult, runAction } from '@/shared/actions/action-result';
import type { ResolvedPermissionsResponse } from '@/core/entities/user-group-permission';
import { getMyPermissionsData } from '@/server/queries/permission';

/**
 * Server Action do módulo Permissions. Substitui `GET /permissions/me`.
 * Guarda: `withTenant` (sem checagem de recurso).
 * Camada: server. Origem: PermissionsController.ts.
 */
export async function getMyPermissionsAction(): Promise<ActionResult<ResolvedPermissionsResponse>> {
  return runAction(() => getMyPermissionsData());
}
