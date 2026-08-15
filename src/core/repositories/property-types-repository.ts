import type {
  CreatePropertyTypeData,
  ListPropertyTypesParams,
  PaginatedPropertyTypes,
  PropertyType,
  UpdatePropertyTypeData,
} from '@/core/entities/property-type';

/**
 * Contrato de acesso a dados de Tipo de Imóvel.
 * Implementação Prisma: infra/repositories/prisma-property-types-repository.ts.
 * Tenant-scoped: roda dentro de `withTenant`.
 *
 * Camada: core.
 * Origem: `prisma.propertyType.*` em api-nairim-v2/src/services/PropertyTypeService.ts.
 */
export interface PropertyTypesRepository {
  list(params: ListPropertyTypesParams): Promise<PaginatedPropertyTypes>;
  getFilters(filters: Record<string, unknown>): Promise<Record<string, unknown>>;
  findById(id: string): Promise<PropertyType | null>;
  descriptionExists(description: string): Promise<boolean>;
  descriptionExistsExcept(description: string, exceptId: string): Promise<boolean>;
  create(data: CreatePropertyTypeData): Promise<PropertyType>;
  update(id: string, data: UpdatePropertyTypeData): Promise<PropertyType>;
  /**
   * Soft-delete (+ cascata para Property e Lease com `type_id` igual, ainda
   * ativos). @returns null se não existir/já excluído.
   */
  softDelete(id: string): Promise<PropertyType | null>;
  findDeletionState(id: string): Promise<{ description: string; deleted_at: Date | null } | null>;
  restore(id: string): Promise<PropertyType>;
}
