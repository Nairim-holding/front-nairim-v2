import { PrismaPropertiesRepository } from '@/infra/repositories/prisma-properties-repository';
import { minioStorage } from '@/infra/storage/minio-storage';
import { ListPropertiesUseCase, GetPropertyFiltersUseCase, GetPropertyByIdUseCase } from '@/core/use-cases/property/read';
import { CreateUnifiedPropertyUseCase } from '@/core/use-cases/property/create-unified';
import { UpdateUnifiedPropertyUseCase } from '@/core/use-cases/property/update-unified';
import { DeletePropertyUseCase, RestorePropertyUseCase } from '@/core/use-cases/property/crud';

/** Composition root do módulo Properties. Camada: infra. */
const properties = new PrismaPropertiesRepository();

export const propertyUseCases = {
  list: new ListPropertiesUseCase(properties),
  getFilters: new GetPropertyFiltersUseCase(properties),
  getById: new GetPropertyByIdUseCase(properties),
  createUnified: new CreateUnifiedPropertyUseCase(properties, minioStorage),
  updateUnified: new UpdateUnifiedPropertyUseCase(properties, minioStorage),
  remove: new DeletePropertyUseCase(properties),
  restore: new RestorePropertyUseCase(properties),
};
