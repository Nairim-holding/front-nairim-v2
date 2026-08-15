import type { TransactionsRepository } from '@/core/repositories/financial-transactions-repository';
import type {
  CreateInstallmentsData,
  CreateRecurrenceData,
  CreateTransactionData,
  CreateTransferData,
  InstallmentsResult,
  ListTransactionsParams,
  PaginatedTransactions,
  RecurrenceResult,
  RelatedTransactionsResult,
  Transaction,
  TransactionFiltersResult,
  TransactionStatus,
  TransferResult,
  UpdateTransactionData,
} from '@/core/entities/financial-transaction';
import { NotFoundError, ValidationError } from '@/core/errors/domain-errors';

/**
 * Casos de uso de Lancamento Financeiro.
 * Camada: core.
 * Origem: api-nairim-v2/src/services/TransactionService.ts,
 * TransferService.ts, RecurringService.ts + respectivos controllers.
 * Rodam dentro do contexto de tenant (withTenant), portanto o `company_id`
 * e injetado automaticamente pela extensao do Prisma nos creates/mutations.
 *
 * FIDELIDADE: mensagens e status replicam as validacoes do backend
 * (TransactionValidator + validacoes de serviço).
 */

const TRANSACTION_STATUSES: TransactionStatus[] = ['PENDING', 'COMPLETED'];

const VALID_FREQUENCIES = [
  'WEEKLY',
  'BIWEEKLY',
  'MONTHLY',
  'BIMONTHLY',
  'QUARTERLY',
  'SEMIANNUAL',
  'YEARLY',
] as const;

function parseAmount(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const clean = value.replace(/[R$\s]/g, '').replace(',', '.');
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

export class ListTransactionsUseCase {
  constructor(private readonly transactions: TransactionsRepository) {}
  async execute(params: ListTransactionsParams): Promise<PaginatedTransactions> {
    return this.transactions.list(params);
  }
}

export class GetTransactionFiltersUseCase {
  constructor(private readonly transactions: TransactionsRepository) {}
  async execute(filters?: Record<string, unknown>): Promise<TransactionFiltersResult> {
    return this.transactions.getFilters(filters);
  }
}

export class GetTransactionByIdUseCase {
  constructor(private readonly transactions: TransactionsRepository) {}
  async execute(id: string): Promise<Transaction> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    const transaction = await this.transactions.findById(id);
    if (!transaction) throw new NotFoundError('Lançamento não encontrado');
    return transaction;
  }
}

export class CreateTransactionUseCase {
  constructor(private readonly transactions: TransactionsRepository) {}
  async execute(data: CreateTransactionData): Promise<Transaction> {
    if (!data.event_date) throw new ValidationError('A Data do Evento é obrigatória');
    if (!data.effective_date) throw new ValidationError('A Data de Efetivação é obrigatória');
    if (data.amount === undefined || data.amount === null || isNaN(Number(data.amount))) {
      throw new ValidationError('O Valor deve ser numérico e é obrigatório');
    }
    if (!data.category_id?.trim()) throw new ValidationError('A Categoria é obrigatória');
    if (!data.financial_institution_id?.trim()) {
      throw new ValidationError('A Instituição Financeira é obrigatória');
    }
    if (data.status && !TRANSACTION_STATUSES.includes(data.status)) {
      throw new ValidationError('Status inválido. Deve ser PENDING ou COMPLETED');
    }
    return this.transactions.create(data);
  }
}

export class UpdateTransactionUseCase {
  constructor(private readonly transactions: TransactionsRepository) {}
  async execute(id: string, data: UpdateTransactionData): Promise<Transaction> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    if (data.amount !== undefined && isNaN(Number(data.amount))) {
      throw new ValidationError('O Valor deve ser numérico');
    }
    if (data.status !== undefined && !TRANSACTION_STATUSES.includes(data.status)) {
      throw new ValidationError('Status inválido. Deve ser PENDING ou COMPLETED');
    }
    if (data.propagate_fields !== undefined && !Array.isArray(data.propagate_fields)) {
      throw new ValidationError('propagate_fields deve ser uma lista de campos');
    }
    const existing = await this.transactions.findById(id);
    if (!existing) throw new NotFoundError('Lançamento não encontrado');
    return this.transactions.update(id, data);
  }
}

export class DeleteTransactionUseCase {
  constructor(private readonly transactions: TransactionsRepository) {}
  async execute(id: string): Promise<void> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    await this.transactions.delete(id);
  }
}

export class RestoreTransactionUseCase {
  constructor(private readonly transactions: TransactionsRepository) {}
  async execute(id: string): Promise<Transaction> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    const state = await this.transactions.findDeletionState(id);
    if (!state) throw new NotFoundError('Lançamento não encontrado');
    if (!state.deleted_at) throw new ValidationError('Lançamento não está excluído');
    return this.transactions.restore(id);
  }
}

export class CreateTransferUseCase {
  constructor(private readonly transactions: TransactionsRepository) {}
  async execute(data: CreateTransferData): Promise<TransferResult> {
    if (!data.financial_institution_id) throw new ValidationError('Instituição de origem é obrigatória.');
    if (!data.destination_institution_id) throw new ValidationError('Instituição de destino é obrigatória.');
    if (!data.destination_center_id) throw new ValidationError('Centro de Receita de destino é obrigatório.');
    if (String(data.financial_institution_id) === String(data.destination_institution_id)) {
      throw new ValidationError('A conta de destino deve ser diferente da conta de origem.');
    }
    const amount = Number(data.amount);
    if (!amount || amount <= 0) throw new ValidationError('Valor da transferência deve ser maior que zero.');
    return this.transactions.createTransfer(data);
  }
}

export class CreateInstallmentsUseCase {
  constructor(private readonly transactions: TransactionsRepository) {}
  async execute(data: CreateInstallmentsData): Promise<InstallmentsResult> {
    if (!data.institution_id?.trim()) throw new ValidationError('A Instituição Financeira é obrigatória');
    if (!data.category_id?.trim()) throw new ValidationError('A Categoria é obrigatória');

    const installmentAmount = parseAmount(data.installment_amount);
    if (installmentAmount === null || isNaN(installmentAmount)) {
      throw new ValidationError('O Valor da Parcela deve ser numérico e é obrigatório');
    }
    if (installmentAmount <= 0) throw new ValidationError('O Valor da Parcela deve ser maior que zero');

    if (data.num_installments === undefined || data.num_installments === null || isNaN(Number(data.num_installments))) {
      throw new ValidationError('O Número de Parcelas é obrigatório');
    }
    const num = Number(data.num_installments);
    if (num < 2 || num > 120) throw new ValidationError('O Número de Parcelas deve estar entre 2 e 120');

    const totalAmount = parseAmount(data.total_amount);
    if (totalAmount === null || isNaN(totalAmount)) {
      throw new ValidationError('O Valor Total deve ser numérico e é obrigatório');
    }
    const expectedTotal = installmentAmount !== null ? installmentAmount * num : 0;
    if (expectedTotal > 0 && Math.abs(totalAmount - expectedTotal) > 0.01) {
      throw new ValidationError(`Total inválido: esperado ${expectedTotal.toFixed(2)}, recebido ${totalAmount.toFixed(2)}`);
    }

    if (!data.start_date) throw new ValidationError('A Data de Início é obrigatória');
    if (!data.first_payment_date) throw new ValidationError('A Data do Primeiro Pagamento é obrigatória');

    const firstPayment = new Date(data.first_payment_date);
    const startDate = new Date(data.start_date);
    if (!isNaN(firstPayment.getTime()) && !isNaN(startDate.getTime())) {
      if (firstPayment < startDate) {
        throw new ValidationError('A Data do Primeiro Pagamento deve ser igual ou posterior à Data de Início');
      }
    }

    if (data.transaction_type && !['EXPENSE', 'INCOME'].includes(data.transaction_type)) {
      throw new ValidationError('Parcelado deve ser do tipo EXPENSE ou INCOME');
    }

    return this.transactions.createInstallments({
      ...data,
      installment_amount: installmentAmount ?? 0,
      total_amount: totalAmount ?? 0,
    });
  }
}

export class CreateRecurrenceUseCase {
  constructor(private readonly transactions: TransactionsRepository) {}
  async execute(data: CreateRecurrenceData): Promise<RecurrenceResult> {
    const amount = parseAmount(data.amount);
    if (amount === null || amount <= 0) throw new ValidationError('Valor deve ser maior que zero');
    if (!data.category_id?.trim()) throw new ValidationError('Categoria é obrigatória');
    if (!data.institution_id?.trim()) throw new ValidationError('Instituição financeira é obrigatória');

    const frequency = data.frequency ?? 'MONTHLY';
    if (!VALID_FREQUENCIES.includes(frequency)) {
      throw new ValidationError('Frequência inválida');
    }

    const firstPayment = new Date(data.first_payment_date);
    const startDate = new Date(data.start_date);
    if (!isNaN(firstPayment.getTime()) && !isNaN(startDate.getTime())) {
      if (firstPayment < startDate) {
        throw new ValidationError('Data de primeiro pagamento deve ser igual ou posterior à data inicial');
      }
    }

    return this.transactions.createRecurrence({ ...data, amount });
  }
}

export class GetRelatedTransactionsUseCase {
  constructor(private readonly transactions: TransactionsRepository) {}
  async execute(id: string): Promise<RelatedTransactionsResult> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    return this.transactions.getRelated(id);
  }
}