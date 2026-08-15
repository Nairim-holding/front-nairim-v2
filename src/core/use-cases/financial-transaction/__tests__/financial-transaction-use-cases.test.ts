import { describe, it, expect, beforeEach } from 'vitest';
import type { TransactionsRepository } from '@/core/repositories/financial-transactions-repository';
import type {
  AvailableYearsResult,
  CreateInstallmentsData,
  CreateRecurrenceData,
  CreateTransactionData,
  CreateTransferData,
  ExpenseByCategoryResult,
  InstallmentsResult,
  ListTransactionsParams,
  MonthlySummary,
  MonthlySummaryMultiResult,
  PaginatedTransactions,
  RecurrenceResult,
  RelatedTransactionsResult,
  SubcategoryBreakdownResult,
  Transaction,
  TransactionDocument,
  TransactionEntityFilters,
  TransactionFiltersResult,
  TransactionStatus,
  TransferResult,
  UpdateTransactionData,
} from '@/core/entities/financial-transaction';
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
import { NotFoundError, ValidationError } from '@/core/errors/domain-errors';

const now = new Date('2026-01-10T12:00:00Z');

function makeTransaction(over: Partial<Transaction> = {}): Transaction {
  return {
    id: 't-1',
    company_id: 'c-1',
    event_date: now,
    effective_date: now,
    purchase_date: null,
    description: 'Lanche',
    amount: 150,
    status: 'PENDING',
    category_id: 'cat-1',
    subcategory_id: null,
    financial_institution_id: 'inst-1',
    card_id: null,
    center_id: null,
    supplier_id: null,
    invoice_id: null,
    lease_id: null,
    installment_number: null,
    total_installments: null,
    is_recurring: false,
    occurrence_number: null,
    parent_transaction_id: null,
    payment_mode: null,
    recurring_frequency: null,
    recurring_group_id: null,
    transfer_group_id: null,
    is_transfer: false,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    ...over,
  };
}

class InMemoryTransactionsRepository implements TransactionsRepository {
  items: Transaction[] = [];

  async list(_params: ListTransactionsParams): Promise<PaginatedTransactions> {
    const data = this.items.filter((t) => !t.deleted_at);
    return {
      data,
      count: data.length,
      totalPages: 1,
      currentPage: 1,
      summary: [],
      totals: {
        periodIncome: 0,
        periodExpense: 0,
        periodBalance: 0,
        accumulatedIncome: 0,
        accumulatedExpense: 0,
        accumulatedBalance: 0,
        receitasPrevisto: 0,
        receitasRecebido: 0,
        despesasPrevisto: 0,
        despesasPago: 0,
      },
    };
  }
  async getFilters(): Promise<TransactionFiltersResult> {
    return { filters: [], operators: {}, defaultSort: 'event_date', searchFields: [] };
  }
  async findById(id: string) {
    return this.items.find((t) => t.id === id && !t.deleted_at) ?? null;
  }
  async create(data: CreateTransactionData & { company_id?: string }): Promise<Transaction> {
    const tx: Transaction = makeTransaction({
      ...(data as unknown as Partial<Transaction>),
      id: `t-${this.items.length + 1}`,
      event_date: new Date(String(data.event_date)),
      effective_date: new Date(String(data.effective_date)),
      status: (data.status ?? 'PENDING') as TransactionStatus,
      company_id: data.company_id ?? 'c-1',
    });
    this.items.push(tx);
    return tx;
  }
  async update(id: string, data: UpdateTransactionData): Promise<Transaction> {
    const tx = this.items.find((t) => t.id === id)!;
    const patch: Record<string, unknown> = { ...data };
    delete patch.propagate_to_following;
    delete patch.propagate_fields;
    Object.assign(tx, patch);
    return tx;
  }
  async delete(id: string): Promise<Transaction> {
    const tx = this.items.find((t) => t.id === id && !t.deleted_at);
    if (!tx) throw new NotFoundError('Lançamento não encontrado');
    tx.deleted_at = new Date();
    return tx;
  }
  async findDeletionState(id: string) {
    const tx = this.items.find((t) => t.id === id);
    return tx ? { id: tx.id, deleted_at: tx.deleted_at } : null;
  }
  async restore(id: string): Promise<Transaction> {
    const tx = this.items.find((t) => t.id === id)!;
    tx.deleted_at = null;
    return tx;
  }
  async createTransfer(data: CreateTransferData & { company_id?: string }): Promise<TransferResult> {
    const base = makeTransaction({
      id: `tr-${this.items.length + 1}`,
      description: data.description ?? 'Transferência',
      amount: data.amount,
      event_date: new Date(String(data.event_date)),
      effective_date: new Date(String(data.effective_date)),
      category_id: data.category_id,
      financial_institution_id: data.financial_institution_id,
      is_transfer: true,
      transfer_group_id: `g-${this.items.length + 1}`,
    });
    const mirror = { ...base, id: `tr-${this.items.length + 2}`, financial_institution_id: data.destination_institution_id };
    this.items.push(base, mirror);
    return { transfer_group_id: base.transfer_group_id!, origin: base, mirror };
  }
  async createInstallments(data: CreateInstallmentsData & { company_id?: string }): Promise<InstallmentsResult> {
    const installments = Array.from({ length: data.num_installments }, (_, i) =>
      makeTransaction({
        id: `par-${this.items.length + 1 + i}`,
        description: `${data.description ?? 'Parcela'} ${i + 1}/${data.num_installments}`,
        amount: data.installment_amount,
        installment_number: i + 1,
        total_installments: data.num_installments,
        payment_mode: 'PARCELADO',
        event_date: new Date(String(data.start_date)),
        effective_date: new Date(String(data.first_payment_date)),
      }),
    );
    this.items.push(...installments);
    return {
      success: true,
      message: 'parcelas criadas',
      data: {
        num_installments: data.num_installments,
        installment_amount: data.installment_amount,
        total_amount: data.installment_amount * data.num_installments,
        installments: installments.map((inst) => ({
          id: inst.id,
          installment_number: inst.installment_number!,
          amount: inst.amount,
          effective_date: inst.effective_date,
          description: inst.description,
          status: inst.status as TransactionStatus,
          invoice_id: inst.invoice_id,
        })),
      },
      validation: {
        sum_of_installments: data.installment_amount * data.num_installments,
        expected_total: data.total_amount,
        matches: true,
      },
    };
  }
  async createRecurrence(data: CreateRecurrenceData & { company_id?: string }): Promise<RecurrenceResult> {
    const frequency = data.frequency ?? 'MONTHLY';
    return { success: true, message: 'recorrentes criados', data: { recurring_group_id: 'rc-1', frequency, generated: 60 } };
  }
  async getRelated(id: string): Promise<RelatedTransactionsResult> {
    void id;
    return { parent: null, related_transactions: [] };
  }

  // ─── Stubs de relatórios (cobrem o contrato; determinísticos o suficiente) ─
  async getMonthlySummary(year: number, _filters?: TransactionEntityFilters): Promise<MonthlySummary> {
    return { year, months: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, income: 0, expense: 0 })) };
  }
  async getMonthlySummaryMulti(years: number[], _filters?: TransactionEntityFilters): Promise<MonthlySummaryMultiResult> {
    return years.map((year) => ({ year, months: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, income: 0, expense: 0 })) }));
  }
  async getAvailableYears(): Promise<AvailableYearsResult> {
    return { years: [2026] };
  }
  async getExpenseByCategory(_startDate: Date, _endDate: Date, _filters?: TransactionEntityFilters): Promise<ExpenseByCategoryResult> {
    return { totalIncome: 0, categories: [] };
  }
  async getSubcategoryBreakdown(_categoryId: string, _startDate: Date, _endDate: Date, _filters?: TransactionEntityFilters): Promise<SubcategoryBreakdownResult> {
    return { categoryId: 'cat-1', categoryName: 'Categoria', total: 0, subcategories: [] };
  }
  async listDocuments(_transactionId: string): Promise<TransactionDocument[]> {
    return [];
  }
  async countDocuments(_transactionId: string): Promise<number> {
    return 0;
  }
  async createDocuments(
    _transactionId: string,
    documents: Array<{ url: string; mimetype: string; description: string; createdBy: string | null }>,
  ): Promise<TransactionDocument[]> {
    return documents.map((d) => ({
      id: 'doc-1',
      transaction_id: null,
      file_path: d.url,
      file_type: d.mimetype,
      description: d.description,
      created_by: d.createdBy,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    }));
  }
  async removeDocuments(_transactionId: string, documentIds: string[]): Promise<void> {
    void documentIds;
  }
}

function seed(repo: InMemoryTransactionsRepository, over: Partial<Transaction> = {}) {
  repo.items.push(makeTransaction(over));
}

describe('FinancialTransaction use-cases', () => {
  let repo: InMemoryTransactionsRepository;
  beforeEach(() => { repo = new InMemoryTransactionsRepository(); });

  describe('CreateTransactionUseCase', () => {
    const base = {
      event_date: '2026-01-10',
      effective_date: '2026-01-10',
      amount: 150,
      category_id: 'cat-1',
      financial_institution_id: 'inst-1',
    };

    it('cria lançamento com status PENDING padrão', async () => {
      const out = await new CreateTransactionUseCase(repo).execute(base);
      expect(out.amount).toBe(150);
      expect(out.status).toBe('PENDING');
    });
    it('rejeita sem event_date (400)', async () => {
      const data: any = { ...base };
      delete data.event_date;
      await expect(new CreateTransactionUseCase(repo).execute(data)).rejects.toBeInstanceOf(ValidationError);
    });
    it('rejeita sem effective_date (400)', async () => {
      const data: any = { ...base };
      delete data.effective_date;
      await expect(new CreateTransactionUseCase(repo).execute(data)).rejects.toBeInstanceOf(ValidationError);
    });
    it('rejeita amount ausente (400)', async () => {
      const data: any = { ...base };
      delete data.amount;
      await expect(new CreateTransactionUseCase(repo).execute(data)).rejects.toBeInstanceOf(ValidationError);
    });
    it('rejeita sem categoria (400)', async () => {
      await expect(new CreateTransactionUseCase(repo).execute({ ...base, category_id: '  ' })).rejects.toBeInstanceOf(ValidationError);
    });
    it('rejeita sem instituição (400)', async () => {
      await expect(new CreateTransactionUseCase(repo).execute({ ...base, financial_institution_id: '' })).rejects.toBeInstanceOf(ValidationError);
    });
    it('rejeita status inválido (400)', async () => {
      await expect(new CreateTransactionUseCase(repo).execute({ ...base, status: 'DONE' } as any)).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('GetTransactionByIdUseCase', () => {
    it('retorna lançamento existente', async () => {
      seed(repo);
      expect((await new GetTransactionByIdUseCase(repo).execute('t-1')).description).toBe('Lanche');
    });
    it('lança NotFound quando não existe (404)', async () => {
      await expect(new GetTransactionByIdUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
    it('lança ValidationError sem id (400)', async () => {
      await expect(new GetTransactionByIdUseCase(repo).execute('')).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('UpdateTransactionUseCase', () => {
    it('lança NotFound se não existe', async () => {
      await expect(new UpdateTransactionUseCase(repo).execute('ghost', { amount: 1 })).rejects.toBeInstanceOf(NotFoundError);
    });
    it('rejeita amount não numérico (400)', async () => {
      seed(repo);
      await expect(new UpdateTransactionUseCase(repo).execute('t-1', { amount: Number('x') })).rejects.toBeInstanceOf(ValidationError);
    });
    it('rejeita status inválido (400)', async () => {
      seed(repo);
      await expect(new UpdateTransactionUseCase(repo).execute('t-1', { status: 'X' as any })).rejects.toBeInstanceOf(ValidationError);
    });
    it('rejeita propagate_fields não-lista (400)', async () => {
      seed(repo);
      await expect(new UpdateTransactionUseCase(repo).execute('t-1', { propagate_fields: 'amount' as any })).rejects.toBeInstanceOf(ValidationError);
    });
    it('atualiza valores válidos', async () => {
      seed(repo);
      const out = await new UpdateTransactionUseCase(repo).execute('t-1', { amount: 999, status: 'COMPLETED' });
      expect(out.amount).toBe(999);
      expect(out.status).toBe('COMPLETED');
    });
  });

  describe('DeleteTransactionUseCase', () => {
    it('soft-delete com sucesso', async () => {
      seed(repo);
      await new DeleteTransactionUseCase(repo).execute('t-1');
      expect(repo.items[0].deleted_at).not.toBeNull();
    });
    it('lança NotFound se não existe', async () => {
      await expect(new DeleteTransactionUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('RestoreTransactionUseCase', () => {
    it('restaura lançamento excluído', async () => {
      seed(repo, { deleted_at: now });
      const out = await new RestoreTransactionUseCase(repo).execute('t-1');
      expect(out.deleted_at).toBeNull();
    });
    it('lança se lançamento não está excluído (400)', async () => {
      seed(repo);
      await expect(new RestoreTransactionUseCase(repo).execute('t-1')).rejects.toBeInstanceOf(ValidationError);
    });
    it('lança NotFound se não existe (404)', async () => {
      await expect(new RestoreTransactionUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('CreateTransferUseCase', () => {
    it('cria transferência com contas distintas', async () => {
      const data: CreateTransferData = {
        financial_institution_id: 'inst-1',
        destination_institution_id: 'inst-2',
        destination_center_id: 'cent-1',
        amount: 300,
        category_id: 'cat-t',
        event_date: '2026-01-10',
        effective_date: '2026-01-10',
      };
      const out = await new CreateTransferUseCase(repo).execute(data);
      expect(out.transfer_group_id).toBeTruthy();
      expect(out.mirror.financial_institution_id).toBe('inst-2');
    });
    it('rejeita conta de destino igual à origem (400)', async () => {
      await expect(
        new CreateTransferUseCase(repo).execute({
          financial_institution_id: 'inst-1',
          destination_institution_id: 'inst-1',
          destination_center_id: 'cent-1',
          amount: 300,
          category_id: 'cat-t',
          event_date: '2026-01-10',
          effective_date: '2026-01-10',
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
    it('rejeita valor zero/negativo (400)', async () => {
      await expect(
        new CreateTransferUseCase(repo).execute({
          financial_institution_id: 'inst-1',
          destination_institution_id: 'inst-2',
          destination_center_id: 'cent-1',
          amount: 0,
          category_id: 'cat-t',
          event_date: '2026-01-10',
          effective_date: '2026-01-10',
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('CreateInstallmentsUseCase', () => {
    const base = {
      transaction_type: 'EXPENSE' as const,
      institution_id: 'inst-1',
      category_id: 'cat-1',
      installment_amount: 100,
      num_installments: 3,
      total_amount: 300,
      start_date: '2026-01-10',
      first_payment_date: '2026-02-10',
    };

    it('cria parcelas entre 2 e 120', async () => {
      const out = await new CreateInstallmentsUseCase(repo).execute(base);
      expect(out.data.num_installments).toBe(3);
      expect(out.data.installments).toHaveLength(3);
    });
    it('rejeita instituição ausente (400)', async () => {
      await expect(new CreateInstallmentsUseCase(repo).execute({ ...base, institution_id: '' })).rejects.toBeInstanceOf(ValidationError);
    });
    it('rejeita categoria ausente (400)', async () => {
      await expect(new CreateInstallmentsUseCase(repo).execute({ ...base, category_id: '' })).rejects.toBeInstanceOf(ValidationError);
    });
    it('rejeita valor de parcela <= 0 (400)', async () => {
      await expect(new CreateInstallmentsUseCase(repo).execute({ ...base, installment_amount: 0 })).rejects.toBeInstanceOf(ValidationError);
    });
    it('rejeita número de parcelas fora do intervalo (400)', async () => {
      await expect(new CreateInstallmentsUseCase(repo).execute({ ...base, num_installments: 1 })).rejects.toBeInstanceOf(ValidationError);
      await expect(new CreateInstallmentsUseCase(repo).execute({ ...base, num_installments: 121 })).rejects.toBeInstanceOf(ValidationError);
    });
    it('rejeita total inconsistente (400)', async () => {
      await expect(new CreateInstallmentsUseCase(repo).execute({ ...base, total_amount: 300.5 })).rejects.toBeInstanceOf(ValidationError);
    });
    it('rejeita primeiro pagamento antes do início (400)', async () => {
      await expect(new CreateInstallmentsUseCase(repo).execute({ ...base, first_payment_date: '2026-01-05' })).rejects.toBeInstanceOf(ValidationError);
    });
    it('rejeita transaction_type inválido (400)', async () => {
      await expect(new CreateInstallmentsUseCase(repo).execute({ ...base, transaction_type: 'X' as any })).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('CreateRecurrenceUseCase', () => {
    const base = {
      frequency: 'MONTHLY' as const,
      institution_id: 'inst-1',
      category_id: 'cat-1',
      amount: 100,
      start_date: '2026-01-10',
      first_payment_date: '2026-01-10',
    };

    it('cria recorrência com frequência padrão MONTHLY', async () => {
      const out = await new CreateRecurrenceUseCase(repo).execute(base);
      expect(out.data.frequency).toBe('MONTHLY');
    });
    it('rejeita valor <= 0 (400)', async () => {
      await expect(new CreateRecurrenceUseCase(repo).execute({ ...base, amount: 0 })).rejects.toBeInstanceOf(ValidationError);
    });
    it('rejeita categoria ausente (400)', async () => {
      await expect(new CreateRecurrenceUseCase(repo).execute({ ...base, category_id: '' })).rejects.toBeInstanceOf(ValidationError);
    });
    it('rejeita instituição ausente (400)', async () => {
      await expect(new CreateRecurrenceUseCase(repo).execute({ ...base, institution_id: '' })).rejects.toBeInstanceOf(ValidationError);
    });
    it('rejeita frequência inválida (400)', async () => {
      await expect(new CreateRecurrenceUseCase(repo).execute({ ...base, frequency: 'ANNUAL' as any })).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('GetRelatedTransactionsUseCase', () => {
    it('lança ValidationError sem id (400)', async () => {
      await expect(new GetRelatedTransactionsUseCase(repo).execute('')).rejects.toBeInstanceOf(ValidationError);
    });
    it('retorna grupos para id válido', async () => {
      seed(repo, { installment_number: 1, total_installments: 3 });
      const out = await new GetRelatedTransactionsUseCase(repo).execute('t-1');
      expect(out.parent).toBeNull();
    });
  });
});