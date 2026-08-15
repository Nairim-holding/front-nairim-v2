import { PrismaFinancialInstitutionsRepository } from '@/infra/repositories/prisma-financial-institutions-repository';
import {
  ListFinancialInstitutionsUseCase,
  GetFinancialInstitutionFiltersUseCase,
  GetFinancialInstitutionByIdUseCase,
  CreateFinancialInstitutionUseCase,
  UpdateFinancialInstitutionUseCase,
  DeleteFinancialInstitutionUseCase,
  RestoreFinancialInstitutionUseCase,
  QuickCreateFinancialInstitutionUseCase,
  GetFinancialBalanceSummaryUseCase,
} from '@/core/use-cases/financial-institution/crud';

/** Composition root do módulo Instituições Financeiras. Camada: infra. */
const institutions = new PrismaFinancialInstitutionsRepository();

export const financialInstitutionUseCases = {
  list: new ListFinancialInstitutionsUseCase(institutions),
  getFilters: new GetFinancialInstitutionFiltersUseCase(institutions),
  getById: new GetFinancialInstitutionByIdUseCase(institutions),
  create: new CreateFinancialInstitutionUseCase(institutions),
  update: new UpdateFinancialInstitutionUseCase(institutions),
  remove: new DeleteFinancialInstitutionUseCase(institutions),
  restore: new RestoreFinancialInstitutionUseCase(institutions),
  quickCreate: new QuickCreateFinancialInstitutionUseCase(institutions),
  getBalanceSummary: new GetFinancialBalanceSummaryUseCase(institutions),
};