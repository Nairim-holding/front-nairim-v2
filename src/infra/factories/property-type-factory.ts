import { PrismaPropertyTypesRepository } from '@/infra/repositories/prisma-property-types-repository';
import {
  ListPropertyTypesUseCase,
  GetPropertyTypeFiltersUseCase,
  GetPropertyTypeByIdUseCase,
  CreatePropertyTypeUseCase,
  UpdatePropertyTypeUseCase,
  DeletePropertyTypeUseCase,
  RestorePropertyTypeUseCase,
} from '@/core/use-cases/property-type/crud';

/** Composition root do módulo Property-types. Camada: infra. */
const propertyTypes = new PrismaPropertyTypesRepository();

export const propertyTypeUseCases = {
  list: new ListPropertyTypesUseCase(propertyTypes),
  getFilters: new GetPropertyTypeFiltersUseCase(propertyTypes),
  getById: new GetPropertyTypeByIdUseCase(propertyTypes),
  create: new CreatePropertyTypeUseCase(propertyTypes),
  update: new UpdatePropertyTypeUseCase(propertyTypes),
  remove: new DeletePropertyTypeUseCase(propertyTypes),
  restore: new RestorePropertyTypeUseCase(propertyTypes),
};
