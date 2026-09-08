'use server';

import { ownerUseCases } from '@/infra/factories/owner-factory';
import { createOwnerSchema, updateOwnerSchema } from '@/shared/validators/owner';
import { type ActionResult, runAction } from '@/shared/actions/action-result';
import { withPermission, withPermissionInput } from '@/infra/auth/session';
import type { ContactSuggestion } from '@/core/entities/agency';
import type { Owner, PaginatedOwners } from '@/core/entities/owner';
import {
  listOwnersData,
  getOwnerByIdData,
  getOwnerFiltersData,
  getOwnerContactSuggestionsData,
} from '@/server/queries/owner';

/**
 * Server Actions do módulo Owners. Substituem os endpoints de `/owners`.
 * Guarda: `withTenant`. Camada: server. Origem: OwnerController.ts.
 */

export async function createOwnerAction(input: Record<string, unknown>): Promise<ActionResult<Owner>> {
  return runAction(async () => {
    const data = createOwnerSchema.parse(input);
    return withPermissionInput('owners', 'create', input, () => ownerUseCases.create.execute(data));
  });
}

export async function updateOwnerAction(id: string, input: Record<string, unknown>): Promise<ActionResult<Owner>> {
  return runAction(async () => {
    const data = updateOwnerSchema.parse(input);
    return withPermissionInput('owners', 'edit', input, () => ownerUseCases.update.execute(id, data));
  });
}

export async function deleteOwnerAction(id: string): Promise<ActionResult<{ name: string }>> {
  return runAction(() => withPermission('owners', 'delete', () => ownerUseCases.remove.execute(id)));
}

export async function restoreOwnerAction(id: string): Promise<ActionResult<Owner>> {
  return runAction(() => withPermission('owners', 'edit', () => ownerUseCases.restore.execute(id)));
}

// ─── Leituras expostas como action (para Client Components) ─────────────────

export async function listOwnersAction(raw: Record<string, unknown>): Promise<ActionResult<PaginatedOwners>> {
  return runAction(() => listOwnersData(raw));
}

export async function getOwnerByIdAction(id: string): Promise<ActionResult<Owner>> {
  return runAction(() => getOwnerByIdData(id));
}

export async function getOwnerFiltersAction(raw: Record<string, unknown>): Promise<ActionResult<Record<string, unknown>>> {
  return runAction(() => getOwnerFiltersData(raw));
}

export async function getOwnerContactSuggestionsAction(search: string): Promise<ActionResult<ContactSuggestion[]>> {
  return runAction(() => getOwnerContactSuggestionsData(search));
}
