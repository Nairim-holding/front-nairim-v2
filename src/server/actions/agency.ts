'use server';

import { agencyUseCases } from '@/infra/factories/agency-factory';
import { createAgencySchema, updateAgencySchema } from '@/shared/validators/agency';
import { type ActionResult, runAction } from '@/shared/actions/action-result';
import { withTenant } from '@/infra/auth/session';
import type { Agency, ContactSuggestion, PaginatedAgencies } from '@/core/entities/agency';
import {
  listAgenciesData,
  getAgencyByIdData,
  getAgencyFiltersData,
  getContactSuggestionsData,
} from '@/server/queries/agency';

/**
 * Server Actions do módulo Agencies. Substituem os endpoints de `/agencies`.
 * Guarda: `withTenant` (autenticado + empresa) — igual ao backend.
 *
 * Camada: server (apresentação SSR).
 * Origem: api-nairim-v2/src/controllers/AgencyController.ts.
 */

/** Cria imobiliária. Origem: POST /agencies. */
export async function createAgencyAction(input: Record<string, unknown>): Promise<ActionResult<Agency>> {
  return runAction(async () => {
    const data = createAgencySchema.parse(input);
    return withTenant(() => agencyUseCases.create.execute(data));
  });
}

/** Atualiza imobiliária. Origem: PUT /agencies/:id. */
export async function updateAgencyAction(id: string, input: Record<string, unknown>): Promise<ActionResult<Agency>> {
  return runAction(async () => {
    const data = updateAgencySchema.parse(input);
    return withTenant(() => agencyUseCases.update.execute(id, data));
  });
}

/** Soft-delete. Origem: DELETE /agencies/:id. */
export async function deleteAgencyAction(id: string): Promise<ActionResult<{ legal_name: string }>> {
  return runAction(() => withTenant(() => agencyUseCases.remove.execute(id)));
}

/** Restaura. Origem: PATCH /agencies/:id/restore. */
export async function restoreAgencyAction(id: string): Promise<ActionResult<{ legal_name: string }>> {
  return runAction(() => withTenant(() => agencyUseCases.restore.execute(id)));
}

// ─── Leituras expostas como action (para Client Components) ─────────────────

/** Lista imobiliárias. Origem: GET /agencies. */
export async function listAgenciesAction(raw: Record<string, unknown>): Promise<ActionResult<PaginatedAgencies>> {
  return runAction(() => listAgenciesData(raw));
}

/** Imobiliária por ID. Origem: GET /agencies/:id. */
export async function getAgencyByIdAction(id: string): Promise<ActionResult<Agency>> {
  return runAction(() => getAgencyByIdData(id));
}

/** Filtros do DataTable. Origem: GET /agencies/filters. */
export async function getAgencyFiltersAction(raw: Record<string, unknown>): Promise<ActionResult<Record<string, unknown>>> {
  return runAction(() => getAgencyFiltersData(raw));
}

/** Sugestões de contato. Origem: GET /agencies/suggestions/contacts. */
export async function getAgencyContactSuggestionsAction(search: string): Promise<ActionResult<ContactSuggestion[]>> {
  return runAction(() => getContactSuggestionsData(search));
}
