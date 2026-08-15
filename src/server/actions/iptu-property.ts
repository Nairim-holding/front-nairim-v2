'use server';

import { iptuPropertyUseCases } from '@/infra/factories/planning-factory';
import { type ActionResult, runAction } from '@/shared/actions/action-result';
import { withTenant } from '@/infra/auth/session';
import type { IptuPropertyFiltersResult } from '@/core/entities/iptu-property';

/**
 * Server Action do módulo IPTU do imóvel.
 * Substitui o endpoint GET /iptu-property/filters.
 * Guarda: `withTenant`. Camada: server. Origem: IptuPropertyController.
 */
export async function getIptuPropertyFiltersAction(
  raw?: Record<string, unknown>,
): Promise<ActionResult<IptuPropertyFiltersResult>> {
  return runAction(() => withTenant(() => iptuPropertyUseCases.getFilters.execute(raw)));
}