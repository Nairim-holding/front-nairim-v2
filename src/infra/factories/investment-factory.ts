import { PrismaInvestmentsRepository } from '@/infra/repositories/prisma-investments-repository';
import {
  CreateInvestmentTransactionUseCase,
  CreateInvestmentUseCase,
  DeleteInvestmentTransactionUseCase,
  DeleteInvestmentUseCase,
  GetInvestmentByIdUseCase,
  GetInvestmentDashboardUseCase,
  GetInvestmentFiltersUseCase,
  GetInvestmentSettingsUseCase,
  ListInvestmentTransactionsUseCase,
  ListInvestmentsUseCase,
  ReorderInvestmentsUseCase,
  SaveInvestmentSettingsUseCase,
  SetInvestmentMonthBalanceUseCase,
  UpdateInvestmentNotesUseCase,
  UpdateInvestmentTransactionUseCase,
  UpdateInvestmentUseCase,
} from '@/core/use-cases/investment/crud';

/** Composition root do módulo Investimentos. Camada: infra. */
const investments = new PrismaInvestmentsRepository();

export const investmentUseCases = {
  getDashboard: new GetInvestmentDashboardUseCase(investments),
  list: new ListInvestmentsUseCase(investments),
  getById: new GetInvestmentByIdUseCase(investments),
  create: new CreateInvestmentUseCase(investments),
  update: new UpdateInvestmentUseCase(investments),
  remove: new DeleteInvestmentUseCase(investments),
  reorder: new ReorderInvestmentsUseCase(investments),
  updateNotes: new UpdateInvestmentNotesUseCase(investments),
  listTransactions: new ListInvestmentTransactionsUseCase(investments),
  createTransaction: new CreateInvestmentTransactionUseCase(investments),
  updateTransaction: new UpdateInvestmentTransactionUseCase(investments),
  deleteTransaction: new DeleteInvestmentTransactionUseCase(investments),
  setMonthBalance: new SetInvestmentMonthBalanceUseCase(investments),
  getFilters: new GetInvestmentFiltersUseCase(investments),
  getSettings: new GetInvestmentSettingsUseCase(investments),
  saveSettings: new SaveInvestmentSettingsUseCase(investments),
};
