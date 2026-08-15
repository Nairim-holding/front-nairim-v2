import { PrismaFinancialCentersRepository } from '@/infra/repositories/prisma-financial-centers-repository';
import {
  CreateCenterUseCase,
  DeleteCenterUseCase,
  GetCenterByIdUseCase,
  GetCenterFiltersUseCase,
  ListCentersUseCase,
  QuickCreateCenterUseCase,
  RestoreCenterUseCase,
  UpdateCenterUseCase,
} from '@/core/use-cases/financial-center/crud';

/** Composition root do módulo Centros de Custo. Camada: infra. */
const centers = new PrismaFinancialCentersRepository();

export const financialCenterUseCases = {
  list: new ListCentersUseCase(centers),
  getFilters: new GetCenterFiltersUseCase(centers),
  getById: new GetCenterByIdUseCase(centers),
  create: new CreateCenterUseCase(centers),
  update: new UpdateCenterUseCase(centers),
  remove: new DeleteCenterUseCase(centers),
  restore: new RestoreCenterUseCase(centers),
  quickCreate: new QuickCreateCenterUseCase(centers),
};