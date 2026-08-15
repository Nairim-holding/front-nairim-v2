import { PrismaFinancialSuppliersRepository } from '@/infra/repositories/prisma-financial-suppliers-repository';
import {
  CreateSupplierUseCase,
  DeleteSupplierUseCase,
  GetSupplierByIdUseCase,
  GetSupplierFiltersUseCase,
  ListSuppliersUseCase,
  QuickCreateSupplierUseCase,
  RestoreSupplierUseCase,
  UpdateSupplierUseCase,
} from '@/core/use-cases/financial-supplier/crud';

/** Composition root do módulo Fornecedores. Camada: infra. */
const suppliers = new PrismaFinancialSuppliersRepository();

export const financialSupplierUseCases = {
  list: new ListSuppliersUseCase(suppliers),
  getFilters: new GetSupplierFiltersUseCase(suppliers),
  getById: new GetSupplierByIdUseCase(suppliers),
  create: new CreateSupplierUseCase(suppliers),
  update: new UpdateSupplierUseCase(suppliers),
  remove: new DeleteSupplierUseCase(suppliers),
  restore: new RestoreSupplierUseCase(suppliers),
  quickCreate: new QuickCreateSupplierUseCase(suppliers),
};