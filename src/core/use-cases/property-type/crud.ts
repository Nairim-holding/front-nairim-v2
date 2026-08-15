import type { PropertyTypesRepository } from '@/core/repositories/property-types-repository';
import type {
  CreatePropertyTypeData,
  ListPropertyTypesParams,
  PaginatedPropertyTypes,
  PropertyType,
  UpdatePropertyTypeData,
} from '@/core/entities/property-type';
import { ConflictError, NotFoundError, ValidationError } from '@/core/errors/domain-errors';

/**
 * Casos de uso de Tipo de Imóvel.
 * Camada: core.
 * Origem: api-nairim-v2/src/services/PropertyTypeService.ts + PropertyTypeController.ts.
 */

export class ListPropertyTypesUseCase {
  constructor(private readonly types: PropertyTypesRepository) {}
  async execute(params: ListPropertyTypesParams): Promise<PaginatedPropertyTypes> {
    return this.types.list(params);
  }
}

export class GetPropertyTypeFiltersUseCase {
  constructor(private readonly types: PropertyTypesRepository) {}
  async execute(filters: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.types.getFilters(filters);
  }
}

export class GetPropertyTypeByIdUseCase {
  constructor(private readonly types: PropertyTypesRepository) {}
  async execute(id: string): Promise<PropertyType> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    const type = await this.types.findById(id);
    if (!type) throw new NotFoundError('Tipo de imóvel não encontrado');
    return type;
  }
}

/** Cria tipo de imóvel. Origem: createPropertyType. Regra: description única (409). */
export class CreatePropertyTypeUseCase {
  constructor(private readonly types: PropertyTypesRepository) {}
  async execute(data: CreatePropertyTypeData): Promise<PropertyType> {
    if (await this.types.descriptionExists(data.description)) {
      throw new ConflictError('Este tipo de imóvel já existe');
    }
    return this.types.create(data);
  }
}

/** Atualiza tipo de imóvel. Origem: updatePropertyType. */
export class UpdatePropertyTypeUseCase {
  constructor(private readonly types: PropertyTypesRepository) {}
  async execute(id: string, data: UpdatePropertyTypeData): Promise<PropertyType> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    const existing = await this.types.findById(id);
    if (!existing) throw new NotFoundError('Tipo de imóvel não encontrado');

    if (data.description && data.description !== existing.description) {
      if (await this.types.descriptionExistsExcept(data.description, id)) {
        throw new ConflictError('Este tipo de imóvel já existe');
      }
    }
    return this.types.update(id, data);
  }
}

/**
 * Soft-delete. Origem: deletePropertyType.
 * Cascata: também exclui (soft) Properties e Leases com esse `type_id`.
 */
export class DeletePropertyTypeUseCase {
  constructor(private readonly types: PropertyTypesRepository) {}
  async execute(id: string): Promise<PropertyType> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    const result = await this.types.softDelete(id);
    if (!result) throw new NotFoundError('Tipo de imóvel não encontrado ou já excluído');
    return result;
  }
}

export class RestorePropertyTypeUseCase {
  constructor(private readonly types: PropertyTypesRepository) {}
  async execute(id: string): Promise<PropertyType> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    const state = await this.types.findDeletionState(id);
    if (!state) throw new NotFoundError('Tipo de imóvel não encontrado');
    if (!state.deleted_at) throw new ValidationError('O tipo de imóvel não está excluído');
    return this.types.restore(id);
  }
}
