import type {
  IptuPropertyFiltersParams,
  IptuPropertyFiltersResult,
} from '@/core/entities/iptu-property';

/**
 * Contrato de acesso a dados de IPTU do imóvel (PropertyIptu).
 * Implementacao Prisma: infra/repositories/prisma-iptu-properties-repository.ts.
 *
 * NOTA de tenant: `PropertyIptu` NÃO está em TENANT_MODELS (modelo sem
 * company_id próprio — raiz é Property). A leitura segue o comportamento do
 * backend Express (que também não escopava por empresa nesta rota).
 *
 * Camada: core.
 * Origem: `prisma.propertyIptu.*` em api-nairim-v2/src/services/IptuPropertyService.ts.
 */
export interface IptuPropertiesRepository {
  /** GET /iptu-property/filters — filtros dinâmicos do DynamicFilterModal. */
  getFilters(params?: IptuPropertyFiltersParams): Promise<IptuPropertyFiltersResult>;
}