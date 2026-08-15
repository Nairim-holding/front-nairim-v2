import { PrismaAgenciesRepository } from '@/infra/repositories/prisma-agencies-repository';
import {
  ListAgenciesUseCase,
  GetAgencyFiltersUseCase,
  GetContactSuggestionsUseCase,
  GetAgencyByIdUseCase,
  CreateAgencyUseCase,
  UpdateAgencyUseCase,
  DeleteAgencyUseCase,
  RestoreAgencyUseCase,
} from '@/core/use-cases/agency/crud';

/**
 * Composition root do módulo Agencies.
 * Camada: infra.
 */
const agencies = new PrismaAgenciesRepository();

export const agencyUseCases = {
  list: new ListAgenciesUseCase(agencies),
  getFilters: new GetAgencyFiltersUseCase(agencies),
  getContactSuggestions: new GetContactSuggestionsUseCase(agencies),
  getById: new GetAgencyByIdUseCase(agencies),
  create: new CreateAgencyUseCase(agencies),
  update: new UpdateAgencyUseCase(agencies),
  remove: new DeleteAgencyUseCase(agencies),
  restore: new RestoreAgencyUseCase(agencies),
};
