import { describe, it, expect, beforeEach } from 'vitest';
import type { InvoicesRepository } from '@/core/repositories/financial-invoices-repository';
import type {
  CreateInvoiceData,
  GetInvoiceParams,
  Invoice,
  InvoiceByCardItem,
  InvoiceCard,
  InvoiceStatus,
  InvoiceTransaction,
  InvoiceWithRelations,
  UpdateInvoiceStatusData,
  UpdateInvoiceStatusResult,
} from '@/core/entities/financial-invoice';
import {
  CreateInvoiceUseCase,
  GetInvoiceByCardAndMonthUseCase,
  GetInvoicesByCardUseCase,
  GetInvoiceTransactionsUseCase,
  UpdateInvoiceStatusUseCase,
} from '@/core/use-cases/financial-invoice/crud';
import { ConflictError, NotFoundError, ValidationError } from '@/core/errors/domain-errors';

const now = new Date('2026-01-10T12:00:00Z');

function makeCard(over: Partial<InvoiceCard> = {}): InvoiceCard {
  return { id: 'card-1', name: 'Visa', brand: 'Visa', limit: 5000, closing_day: 5, due_day: 10, ...over };
}

function makeInvoice(over: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv-1',
    company_id: 'c-1',
    card_id: 'card-1',
    month: 1,
    year: 2026,
    total_amount: 0,
    status: 'PENDING',
    closing_date: null,
    due_date: null,
    paid_date: null,
    paid_amount: 0,
    institution_id: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    ...over,
  };
}

function makeTransaction(over: Partial<InvoiceTransaction> = {}): InvoiceTransaction {
  return {
    id: 't-1',
    description: 'Compra',
    amount: 100,
    event_date: now,
    effective_date: now,
    status: 'PENDING',
    installment_number: null,
    total_installments: null,
    category: { id: 'cat-1', name: 'Despesas' },
    supplier: null,
    ...over,
  };
}

class InMemoryInvoicesRepository implements InvoicesRepository {
  invoices: Invoice[] = [];
  transactions: InvoiceTransaction[] = [];
  card: InvoiceCard = makeCard();

  private withRelations(inv: Invoice): InvoiceWithRelations {
    return {
      ...inv,
      total_amount: Number(inv.total_amount),
      paid_amount: Number(inv.paid_amount),
      card: this.card,
      transactions: [...this.transactions],
    };
  }

  async getByCardAndMonth(params: GetInvoiceParams): Promise<InvoiceWithRelations | null> {
    const inv = this.invoices.find(
      (i) => i.card_id === params.cardId && i.month === params.month && i.year === params.year && !i.deleted_at,
    );
    return inv ? this.withRelations(inv) : null;
  }

  async create(data: CreateInvoiceData & { company_id?: string }): Promise<InvoiceWithRelations> {
    if (data.card_id !== this.card.id) throw new NotFoundError('Cartão não encontrado');
    const dup = this.invoices.find(
      (i) => i.card_id === data.card_id && i.month === data.month && i.year === data.year && !i.deleted_at,
    );
    if (dup) throw new ConflictError(`Fatura já existe para ${data.month}/${data.year}`);

    const inv = makeInvoice({
      id: `inv-${this.invoices.length + 1}`,
      card_id: data.card_id,
      month: data.month,
      year: data.year,
      company_id: data.company_id ?? 'c-1',
    });
    this.invoices.push(inv);
    return this.withRelations(inv);
  }

  async updateStatus(id: string, data: UpdateInvoiceStatusData): Promise<UpdateInvoiceStatusResult> {
    const inv = this.invoices.find((i) => i.id === id && !i.deleted_at);
    if (!inv) throw new NotFoundError('Fatura não encontrada');
    if (inv.status === 'COMPLETED' && data.status !== 'COMPLETED') {
      throw new ValidationError('Não é possível alterar o status de uma fatura já concluída');
    }

    inv.status = data.status;
    if (data.status === 'COMPLETED') {
      inv.paid_date = data.effective_date ? new Date(data.effective_date) : new Date();
      inv.paid_amount = Number(data.paid_amount) > 0 ? Number(data.paid_amount) : Number(inv.total_amount);
    }
    if (inv.status === 'PENDING') {
      inv.paid_date = null;
      inv.paid_amount = 0;
    }

    return { ...this.withRelations(inv), updated_transactions: 2 };
  }

  async getTransactions(invoiceId: string): Promise<InvoiceTransaction[]> {
    const inv = this.invoices.find((i) => i.id === invoiceId && !i.deleted_at);
    if (!inv) throw new NotFoundError('Fatura não encontrada');
    return this.transactions;
  }

  async getByCard(cardId: string, year?: number): Promise<InvoiceByCardItem[]> {
    return this.invoices
      .filter((i) => i.card_id === cardId && !i.deleted_at && (year === undefined || i.year === year))
      .map((inv) => ({
        ...inv,
        total_amount: Number(inv.total_amount),
        paid_amount: Number(inv.paid_amount),
        card: this.card,
        transaction_count: this.transactions.length,
      }));
  }
}

function seed(repo: InMemoryInvoicesRepository, over: Partial<Invoice> = {}) {
  repo.invoices.push(makeInvoice(over));
}

describe('FinancialInvoice use-cases', () => {
  let repo: InMemoryInvoicesRepository;
  beforeEach(() => { repo = new InMemoryInvoicesRepository(); });

  describe('GetInvoiceByCardAndMonthUseCase', () => {
    it('retorna a fatura correta para card+month+year', async () => {
      seed(repo);
      const out = await new GetInvoiceByCardAndMonthUseCase(repo).execute({ cardId: 'card-1', month: 1, year: 2026 });
      expect(out).not.toBeNull();
      expect(out?.month).toBe(1);
    });
    it('retorna null quando nao existe', async () => {
      const out = await new GetInvoiceByCardAndMonthUseCase(repo).execute({ cardId: 'card-1', month: 2, year: 2026 });
      expect(out).toBeNull();
    });
    it('rejeita cardId ausente (400)', async () => {
      await expect(new GetInvoiceByCardAndMonthUseCase(repo).execute({ cardId: '', month: 1, year: 2026 })).rejects.toBeInstanceOf(ValidationError);
    });
    it('rejeita mes fora de 1..12 (400)', async () => {
      await expect(new GetInvoiceByCardAndMonthUseCase(repo).execute({ cardId: 'card-1', month: 13, year: 2026 })).rejects.toBeInstanceOf(ValidationError);
    });
    it('rejeita ano fora de 2000..2100 (400)', async () => {
      await expect(new GetInvoiceByCardAndMonthUseCase(repo).execute({ cardId: 'card-1', month: 1, year: 1999 })).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('CreateInvoiceUseCase', () => {
    const base = { card_id: 'card-1', month: 2, year: 2026 };

    it('cria fatura PENDING sem duplicar', async () => {
      const out = await new CreateInvoiceUseCase(repo).execute(base);
      expect(out.status).toBe('PENDING');
      expect(out.month).toBe(2);
    });
    it('rejeita fatura duplicada (409)', async () => {
      await new CreateInvoiceUseCase(repo).execute(base);
      await expect(new CreateInvoiceUseCase(repo).execute(base)).rejects.toBeInstanceOf(ConflictError);
    });
    it('rejeita card_id ausente (400)', async () => {
      await expect(new CreateInvoiceUseCase(repo).execute({ ...base, card_id: '  ' })).rejects.toBeInstanceOf(ValidationError);
    });
    it('rejeita mes invalido (400)', async () => {
      await expect(new CreateInvoiceUseCase(repo).execute({ ...base, month: 0 })).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('UpdateInvoiceStatusUseCase', () => {
    it('atualiza para COMPLETED e retorna updated_transactions', async () => {
      seed(repo);
      const out = await new UpdateInvoiceStatusUseCase(repo).execute('inv-1', { status: 'COMPLETED', effective_date: '2026-01-20' });
      expect(out.status).toBe('COMPLETED');
      expect(out.updated_transactions).toBe(2);
    });
    it('rejeita reabrir fatura concluida para PENDING (400)', async () => {
      seed(repo, { status: 'COMPLETED', paid_date: now, paid_amount: 100 });
      await expect(new UpdateInvoiceStatusUseCase(repo).execute('inv-1', { status: 'PENDING' })).rejects.toBeInstanceOf(
        ValidationError,
      );
    });
    it('rejeita sem id (400)', async () => {
      await expect(new UpdateInvoiceStatusUseCase(repo).execute('', { status: 'COMPLETED' })).rejects.toBeInstanceOf(ValidationError);
    });
    it('rejeita status invalido (400)', async () => {
      await expect(new UpdateInvoiceStatusUseCase(repo).execute('inv-1', { status: 'PAID' as any })).rejects.toBeInstanceOf(ValidationError);
    });
    it('rejeita effective_date com formato invalido (400)', async () => {
      await expect(new UpdateInvoiceStatusUseCase(repo).execute('inv-1', { status: 'COMPLETED', effective_date: '20/01/2026' })).rejects.toBeInstanceOf(ValidationError);
    });
    it('rejeita paid_amount nao numerico (400)', async () => {
      await expect(new UpdateInvoiceStatusUseCase(repo).execute('inv-1', { status: 'COMPLETED', paid_amount: Number('x') })).rejects.toBeInstanceOf(ValidationError);
    });
    it('lança NotFound quando fatura nao existe (404)', async () => {
      await expect(new UpdateInvoiceStatusUseCase(repo).execute('ghost', { status: 'COMPLETED' })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('GetInvoiceTransactionsUseCase', () => {
    it('retorna transacoes da fatura', async () => {
      seed(repo);
      repo.transactions.push(makeTransaction());
      const out = await new GetInvoiceTransactionsUseCase(repo).execute('inv-1');
      expect(out).toHaveLength(1);
      expect(out[0].amount).toBe(100);
    });
    it('rejeita sem id (400)', async () => {
      await expect(new GetInvoiceTransactionsUseCase(repo).execute('')).rejects.toBeInstanceOf(ValidationError);
    });
    it('lança NotFound quando fatura nao existe (404)', async () => {
      await expect(new GetInvoiceTransactionsUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('GetInvoicesByCardUseCase', () => {
    it('lista faturas de um cartao com transaction_count', async () => {
      seed(repo, { id: 'inv-1', month: 1, year: 2026 });
      seed(repo, { id: 'inv-2', month: 2, year: 2026 });
      const out = await new GetInvoicesByCardUseCase(repo).execute('card-1');
      expect(out).toHaveLength(2);
      expect(Number(out[0].transaction_count)).toBe(0);
    });
    it('filtra por ano quando informado', async () => {
      seed(repo, { id: 'inv-1', month: 1, year: 2026 });
      seed(repo, { id: 'inv-2', month: 1, year: 2025 });
      const out = await new GetInvoicesByCardUseCase(repo).execute('card-1', 2026);
      expect(out).toHaveLength(1);
      expect(out[0].year).toBe(2026);
    });
    it('rejeita cardId ausente (400)', async () => {
      await expect(new GetInvoicesByCardUseCase(repo).execute('')).rejects.toBeInstanceOf(ValidationError);
    });
  });
});