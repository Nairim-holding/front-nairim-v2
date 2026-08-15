import { PrismaFinancialTransactionsRepository } from '@/infra/repositories/prisma-financial-transactions-repository';
import { minioStorage } from '@/infra/storage/minio-storage';
import {
  CreateInstallmentsUseCase,
  CreateRecurrenceUseCase,
  CreateTransactionUseCase,
  CreateTransferUseCase,
  DeleteTransactionUseCase,
  GetRelatedTransactionsUseCase,
  GetTransactionByIdUseCase,
  GetTransactionFiltersUseCase,
  ListTransactionsUseCase,
  RestoreTransactionUseCase,
  UpdateTransactionUseCase,
} from '@/core/use-cases/financial-transaction/crud';
import {
  GetAvailableYearsUseCase,
  GetExpenseByCategoryUseCase,
  GetMonthlySummaryMultiUseCase,
  GetMonthlySummaryUseCase,
  GetSubcategoryBreakdownUseCase,
} from '@/core/use-cases/financial-transaction/reports';
import {
  ListTransactionDocumentsUseCase,
  RemoveTransactionDocumentUseCase,
  UploadTransactionDocumentsUseCase,
} from '@/core/use-cases/financial-transaction/attachments';

/** Composition root do módulo Lançamentos. Camada: infra. */
const transactions = new PrismaFinancialTransactionsRepository();

export const financialTransactionUseCases = {
  list: new ListTransactionsUseCase(transactions),
  getFilters: new GetTransactionFiltersUseCase(transactions),
  getById: new GetTransactionByIdUseCase(transactions),
  create: new CreateTransactionUseCase(transactions),
  update: new UpdateTransactionUseCase(transactions),
  remove: new DeleteTransactionUseCase(transactions),
  restore: new RestoreTransactionUseCase(transactions),
  createTransfer: new CreateTransferUseCase(transactions),
  createInstallments: new CreateInstallmentsUseCase(transactions),
  createRecurrence: new CreateRecurrenceUseCase(transactions),
  getRelated: new GetRelatedTransactionsUseCase(transactions),
  getMonthlySummary: new GetMonthlySummaryUseCase(transactions),
  getMonthlySummaryMulti: new GetMonthlySummaryMultiUseCase(transactions),
  getAvailableYears: new GetAvailableYearsUseCase(transactions),
  getExpenseByCategory: new GetExpenseByCategoryUseCase(transactions),
  getSubcategoryBreakdown: new GetSubcategoryBreakdownUseCase(transactions),
  uploadDocuments: new UploadTransactionDocumentsUseCase(transactions, minioStorage),
  removeDocument: new RemoveTransactionDocumentUseCase(transactions, minioStorage),
  listDocuments: new ListTransactionDocumentsUseCase(transactions),
};