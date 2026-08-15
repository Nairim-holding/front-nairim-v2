'use server';

import { tenantUseCases } from '@/infra/factories/tenant-factory';
import { createTenantSchema, updateTenantSchema } from '@/shared/validators/tenant';
import { type ActionResult, runAction } from '@/shared/actions/action-result';
import { withTenant } from '@/infra/auth/session';
import type { ContactSuggestion } from '@/core/entities/agency';
import type { PaginatedTenants, Tenant } from '@/core/entities/tenant';
import {
  listTenantsData,
  getTenantByIdData,
  getTenantFiltersData,
  getTenantContactSuggestionsData,
  getNextTenantInternalCodeData,
} from '@/server/queries/tenant';

/**
 * Server Actions do módulo Tenants. Substituem os endpoints de `/tenants`.
 * Guarda: `withTenant`. Camada: server. Origem: TenantController.ts.
 */

export async function createTenantAction(input: Record<string, unknown>): Promise<ActionResult<Tenant>> {
  return runAction(async () => {
    const data = createTenantSchema.parse(input);
    return withTenant(() => tenantUseCases.create.execute(data));
  });
}

export async function updateTenantAction(id: string, input: Record<string, unknown>): Promise<ActionResult<Tenant>> {
  return runAction(async () => {
    const data = updateTenantSchema.parse(input);
    return withTenant(() => tenantUseCases.update.execute(id, data));
  });
}

export async function deleteTenantAction(id: string): Promise<ActionResult<{ name: string }>> {
  return runAction(() => withTenant(() => tenantUseCases.remove.execute(id)));
}

export async function restoreTenantAction(id: string): Promise<ActionResult<Tenant>> {
  return runAction(() => withTenant(() => tenantUseCases.restore.execute(id)));
}

// ─── Leituras expostas como action (para Client Components) ─────────────────

export async function listTenantsAction(raw: Record<string, unknown>): Promise<ActionResult<PaginatedTenants>> {
  return runAction(() => listTenantsData(raw));
}

export async function getTenantByIdAction(id: string): Promise<ActionResult<Tenant>> {
  return runAction(() => getTenantByIdData(id));
}

export async function getTenantFiltersAction(raw: Record<string, unknown>): Promise<ActionResult<Record<string, unknown>>> {
  return runAction(() => getTenantFiltersData(raw));
}

export async function getTenantContactSuggestionsAction(search: string): Promise<ActionResult<ContactSuggestion[]>> {
  return runAction(() => getTenantContactSuggestionsData(search));
}

/**
 * Próximo código interno sugerido (MAX numérico + 1, escopo da empresa).
 * Origem: GET /tenants/next-internal-code — substitui o antigo
 * sort[internal_code]=desc do front (ordenação lexicográfica bugada).
 */
export async function getNextTenantInternalCodeAction(): Promise<ActionResult<{ next_internal_code: string }>> {
  return runAction(async () => ({ next_internal_code: await getNextTenantInternalCodeData() }));
}
