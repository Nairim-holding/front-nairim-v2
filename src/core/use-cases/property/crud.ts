import type { PropertiesRepository } from '@/core/repositories/properties-repository';
import type { Property } from '@/core/entities/property';
import { NotFoundError, ValidationError } from '@/core/errors/domain-errors';

/**
 * Casos de uso de exclusão/restauração de Imóvel.
 * Camada: core.
 * Origem: api-nairim-v2/src/services/PropertyService.ts (deleteProperty, restoreProperty).
 */

export class DeletePropertyUseCase {
  constructor(private readonly properties: PropertiesRepository) {}
  async execute(id: string): Promise<Property> {
    if (!id) throw new ValidationError('ID is required');
    const result = await this.properties.softDelete(id);
    if (!result) throw new NotFoundError('Property not found or already deleted');
    return result;
  }
}

export class RestorePropertyUseCase {
  constructor(private readonly properties: PropertiesRepository) {}
  async execute(id: string): Promise<Property> {
    if (!id) throw new ValidationError('ID is required');
    const state = await this.properties.findDeletionState(id);
    if (!state) throw new NotFoundError('Property not found');
    if (!state.deleted_at) throw new ValidationError('Property is not deleted');
    return this.properties.restore(id);
  }
}
