import { PrismaFinancialInvoicesRepository } from '@/infra/repositories/prisma-financial-invoices-repository';
import {
  CreateInvoiceUseCase,
  GetInvoiceByCardAndMonthUseCase,
  GetInvoicesByCardUseCase,
  GetInvoiceTransactionsUseCase,
  UpdateInvoiceStatusUseCase,
} from '@/core/use-cases/financial-invoice/crud';

/** Composition root do modulo Faturas de Cartao. Camada: infra. */
const invoices = new PrismaFinancialInvoicesRepository();

export const financialInvoiceUseCases = {
  getByCardAndMonth: new GetInvoiceByCardAndMonthUseCase(invoices),
  create: new CreateInvoiceUseCase(invoices),
  updateStatus: new UpdateInvoiceStatusUseCase(invoices),
  getTransactions: new GetInvoiceTransactionsUseCase(invoices),
  getByCard: new GetInvoicesByCardUseCase(invoices),
};