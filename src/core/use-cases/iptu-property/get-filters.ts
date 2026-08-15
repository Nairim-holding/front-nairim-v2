import type { IptuPropertiesRepository } from '@/core/repositories/iptu-properties-repository';
import type {
  IptuPropertyFiltersParams,
  IptuPropertyFiltersResult,
} from '@/core/entities/iptu-property';

/**
 * Caso de uso do IPTU do imóvel: GET /iptu-property/filters.
 * Camada: core. Origem: api-nairim-v2/src/services/IptuPropertyService.ts.
 * Roda dentro do contexto de tenant, mas `PropertyIptu` não é tenant-scoped.
 */
export class GetIptuPropertyFiltersUseCase {
  constructor(private readonly repository: IptuPropertiesRepository) {}

  execute(params?: IptuPropertyFiltersParams): Promise<IptuPropertyFiltersResult> {
    return this.repository.getFilters(params);
  }
}