import { PrismaFinancialSubcategoriesRepository } from '@/infra/repositories/prisma-financial-subcategories-repository';
import {
  CreateSubcategoryUseCase,
  DeleteSubcategoryUseCase,
  GetSubcategoryByIdUseCase,
  GetSubcategoryFiltersUseCase,
  ListSubcategoriesUseCase,
  QuickCreateSubcategoryUseCase,
  RestoreSubcategoryUseCase,
  UpdateSubcategoryUseCase,
} from '@/core/use-cases/financial-subcategory/crud';

/** Composition root do módulo Subcategorias Financeiras. Camada: infra. */
const subcategories = new PrismaFinancialSubcategoriesRepository();

export const financialSubcategoryUseCases = {
  list: new ListSubcategoriesUseCase(subcategories),
  getFilters: new GetSubcategoryFiltersUseCase(subcategories),
  getById: new GetSubcategoryByIdUseCase(subcategories),
  create: new CreateSubcategoryUseCase(subcategories),
  update: new UpdateSubcategoryUseCase(subcategories),
  remove: new DeleteSubcategoryUseCase(subcategories),
  restore: new RestoreSubcategoryUseCase(subcategories),
  quickCreate: new QuickCreateSubcategoryUseCase(subcategories),
};