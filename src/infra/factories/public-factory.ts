import { PrismaPublicRepository } from '@/infra/repositories/prisma-public-repository';
import {
  GetAvailablePropertiesUseCase,
  GetPublicAgenciesUseCase,
  GetPublicCompanyBySlugUseCase,
  GetPublicOwnersUseCase,
  GetPublicPropertiesUseCase,
  GetPublicPropertyByIdUseCase,
  GetPublicPropertyTypesUseCase,
} from '@/core/use-cases/public/crud';

/** Composition root da vitrine pública. Camada: infra. */
const publicRepo = new PrismaPublicRepository();

export const publicUseCases = {
  getCompanyBySlug: new GetPublicCompanyBySlugUseCase(publicRepo),
  getAvailableProperties: new GetAvailablePropertiesUseCase(publicRepo),
  getProperties: new GetPublicPropertiesUseCase(publicRepo),
  getPropertyById: new GetPublicPropertyByIdUseCase(publicRepo),
  getOwners: new GetPublicOwnersUseCase(publicRepo),
  getPropertyTypes: new GetPublicPropertyTypesUseCase(publicRepo),
  getAgencies: new GetPublicAgenciesUseCase(publicRepo),
};