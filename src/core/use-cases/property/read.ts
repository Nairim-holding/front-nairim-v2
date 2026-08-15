import type { PropertiesRepository } from '@/core/repositories/properties-repository';
import type { ListPropertiesParams, PaginatedProperties, Property } from '@/core/entities/property';
import { NotFoundError, ValidationError } from '@/core/errors/domain-errors';

/**
 * Casos de uso de leitura de Imóvel.
 * Camada: core.
 * Origem: api-nairim-v2/src/services/PropertyService.ts (getProperties, getPropertyById, getPropertyFilters).
 */

export class ListPropertiesUseCase {
  constructor(private readonly properties: PropertiesRepository) {}
  async execute(params: ListPropertiesParams): Promise<PaginatedProperties> {
    return this.properties.list(params);
  }
}

export class GetPropertyFiltersUseCase {
  constructor(private readonly properties: PropertiesRepository) {}
  async execute(filters: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.properties.getFilters(filters);
  }
}

export class GetPropertyByIdUseCase {
  constructor(private readonly properties: PropertiesRepository) {}
  async execute(id: string): Promise<Property> {
    if (!id) throw new ValidationError('ID is required');
    const property = await this.properties.findById(id);
    if (!property) throw new NotFoundError('Property not found');
    return property;
  }
}
