import 'server-only';
import { iptuPropertyUseCases } from '@/infra/factories/planning-factory';
import { withPermission } from '@/infra/auth/session';
import type { IptuPropertyFiltersResult } from '@/core/entities/iptu-property';

/**
 * Queries (leitura) do módulo IPTU do imóvel — para Server Components.
 * Guarda: `withTenant`. Camada: server. Origem: IptuPropertyController.
 */
export async function getIptuPropertyFiltersData(
  raw?: Record<string, unknown>,
): Promise<IptuPropertyFiltersResult> {
  return withPermission('properties', 'view', () => iptuPropertyUseCases.getFilters.execute(raw));
}
