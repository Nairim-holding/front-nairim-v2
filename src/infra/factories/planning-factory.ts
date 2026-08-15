import { PrismaPlanningsRepository } from '@/infra/repositories/prisma-plannings-repository';
import { PrismaIptuPropertiesRepository } from '@/infra/repositories/prisma-iptu-properties-repository';
import {
  DeletePlanningUseCase,
  GetPlanningDashboardUseCase,
  UpsertPlanningUseCase,
} from '@/core/use-cases/planning/crud';
import { GetIptuPropertyFiltersUseCase } from '@/core/use-cases/iptu-property/get-filters';

/** Composition root do módulo Planejamento + IPTU. Camada: infra. */
const plannings = new PrismaPlanningsRepository();
const iptuProperties = new PrismaIptuPropertiesRepository();

export const planningUseCases = {
  upsert: new UpsertPlanningUseCase(plannings),
  remove: new DeletePlanningUseCase(plannings),
  getDashboard: new GetPlanningDashboardUseCase(plannings),
};

export const iptuPropertyUseCases = {
  getFilters: new GetIptuPropertyFiltersUseCase(iptuProperties),
};