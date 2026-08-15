import { PrismaFinancialCategoriesRepository } from '@/infra/repositories/prisma-financial-categories-repository';
import {
  CreateCategoryUseCase,
  DeleteCategoryUseCase,
  GetCategoryByIdUseCase,
  GetCategoryFiltersUseCase,
  ListCategoriesUseCase,
  QuickCreateCategoryUseCase,
  RestoreCategoryUseCase,
  UpdateCategoryUseCase,
} from '@/core/use-cases/financial-category/crud';
import { EnsureTransferCategoriesUseCase } from '@/core/use-cases/transfer/ensure-categories';

/** Composition root do módulo Categorias Financeiras. Camada: infra. */
const categories = new PrismaFinancialCategoriesRepository();

export const financialCategoryUseCases = {
  list: new ListCategoriesUseCase(categories),
  getFilters: new GetCategoryFiltersUseCase(categories),
  getById: new GetCategoryByIdUseCase(categories),
  create: new CreateCategoryUseCase(categories),
  update: new UpdateCategoryUseCase(categories),
  remove: new DeleteCategoryUseCase(categories),
  restore: new RestoreCategoryUseCase(categories),
  quickCreate: new QuickCreateCategoryUseCase(categories),
  ensureTransferCategories: new EnsureTransferCategoriesUseCase(categories),
};