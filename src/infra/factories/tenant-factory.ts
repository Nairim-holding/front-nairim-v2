import { PrismaTenantsRepository } from '@/infra/repositories/prisma-tenants-repository';
import {
  ListTenantsUseCase,
  GetTenantFiltersUseCase,
  GetTenantContactSuggestionsUseCase,
  GetTenantByIdUseCase,
  CreateTenantUseCase,
  UpdateTenantUseCase,
  DeleteTenantUseCase,
  RestoreTenantUseCase,
  GetNextTenantInternalCodeUseCase,
} from '@/core/use-cases/tenant/crud';

/** Composition root do módulo Tenants. Camada: infra. */
const tenants = new PrismaTenantsRepository();

export const tenantUseCases = {
  list: new ListTenantsUseCase(tenants),
  getFilters: new GetTenantFiltersUseCase(tenants),
  getContactSuggestions: new GetTenantContactSuggestionsUseCase(tenants),
  getById: new GetTenantByIdUseCase(tenants),
  create: new CreateTenantUseCase(tenants),
  update: new UpdateTenantUseCase(tenants),
  remove: new DeleteTenantUseCase(tenants),
  restore: new RestoreTenantUseCase(tenants),
  getNextInternalCode: new GetNextTenantInternalCodeUseCase(tenants),
};
