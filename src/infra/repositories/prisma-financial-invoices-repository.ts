import prisma from '@/infra/database/prisma';
import type { InvoicesRepository } from '@/core/repositories/financial-invoices-repository';
import type {
  CreateInvoiceData,
  GetInvoiceParams,
  InvoiceByCardItem,
  InvoiceCard,
  InvoiceStatus,
  InvoiceTransaction,
  InvoiceWithRelations,
  UpdateInvoiceStatusData,
  UpdateInvoiceStatusResult,
} from '@/core/entities/financial-invoice';
import { parseLocalDate } from '@/shared/utils/date-utils';
import { ConflictError, NotFoundError, ValidationError } from '@/core/errors/domain-errors';

/**
 * Implementacao Prisma de {@link InvoicesRepository}.
 * Porte fiel de api-nairim-v2/src/services/InvoiceService.ts.
 *
 * Tenant: `Invoice`/`Transaction` estao em TENANT_MODELS e a extensao injeta
 * `company_id` nas leituras e nos creates. `updateMany` usa apenas `invoice_id`
 * (registros ja resolvidos dentro da mesma fatura do tenant).
 *
 * Camada: infra.
 */

const CARD_SELECT = {
  select: {
    id: true,
    name: true,
    brand: true,
    limit: true,
    closing_day: true,
    due_day: true,
  },
} as const;

const TRANSACTION_INCLUDE = {
  category: { select: { id: true, name: true } },
  supplier: { select: { id: true, legal_name: true } },
} as const;

function mapCard(card: any): InvoiceCard {
  return {
    id: card.id,
    name: card.name,
    brand: card.brand,
    limit: Number(card.limit ?? 0),
    closing_day: card.closing_day,
    due_day: card.due_day,
  };
}

export class PrismaFinancialInvoicesRepository implements InvoicesRepository {
  async getByCardAndMonth(params: GetInvoiceParams): Promise<InvoiceWithRelations | null> {
    const { cardId, month, year } = params;

    const invoice = (await prisma.invoice.findFirst({
      where: { card_id: cardId, month, year, deleted_at: null },
      include: {
        card: CARD_SELECT as never,
        transactions: {
          where: { deleted_at: null },
          orderBy: { event_date: 'asc' },
          include: TRANSACTION_INCLUDE as never,
        },
      },
    })) as unknown as
      | (Record<string, unknown> & {
          id: string;
          total_amount: unknown;
          transactions: any[];
          card: any;
        })
      | null;

    if (!invoice) return null;

    // Recalcular total a partir das transacoes e atualizar quando divergente.
    const calculatedTotal = invoice.transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    if (calculatedTotal !== Number(invoice.total_amount)) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { total_amount: calculatedTotal },
      });
      invoice.total_amount = calculatedTotal;
    }

    return {
      ...invoice,
      total_amount: Number(invoice.total_amount ?? 0),
      paid_amount: Number((invoice as Record<string, unknown>).paid_amount ?? 0),
      card: mapCard(invoice.card),
      transactions: invoice.transactions.map((t) => this.mapTransaction(t)),
    } as unknown as InvoiceWithRelations;
  }

  async create(data: CreateInvoiceData & { company_id?: string }): Promise<InvoiceWithRelations> {
    const { card_id, month, year, closing_date, due_date } = data;

    const card = await prisma.card.findFirst({ where: { id: card_id, deleted_at: null } });
    if (!card) throw new NotFoundError('Cartão não encontrado');

    const existing = await prisma.invoice.findFirst({
      where: { card_id, month, year, deleted_at: null },
      select: { id: true },
    });
    if (existing) throw new ConflictError(`Fatura já existe para ${month}/${year}`);

    // Datas de fechamento/vencimento calculadas automaticamente se nao fornecidas.
    let finalClosingDate: Date;
    let finalDueDate: Date;

    if (closing_date) {
      finalClosingDate = parseLocalDate(closing_date);
    } else {
      finalClosingDate = new Date(Date.UTC(year, month - 1, card.closing_day ?? 1));
    }

    if (due_date) {
      finalDueDate = parseLocalDate(due_date);
    } else {
      finalDueDate = new Date(Date.UTC(year, month - 1, card.due_day ?? 10));
      if (finalDueDate < finalClosingDate) {
        finalDueDate = new Date(Date.UTC(year, month, card.due_day ?? 10));
      }
    }

    const invoice = await prisma.invoice.create({
      data: {
        card_id,
        month,
        year,
        closing_date: finalClosingDate,
        due_date: finalDueDate,
        total_amount: 0,
        paid_amount: 0,
        status: 'PENDING',
        company_id: data.company_id,
      } as never,
      include: { card: CARD_SELECT as never },
    });

    return {
      ...invoice,
      total_amount: Number(invoice.total_amount ?? 0),
      paid_amount: Number(invoice.paid_amount ?? 0),
      card: mapCard((invoice as any).card),
      transactions: [],
    } as unknown as InvoiceWithRelations;
  }

  async updateStatus(id: string, data: UpdateInvoiceStatusData): Promise<UpdateInvoiceStatusResult> {
    const { status, effective_date, paid_amount, institution_id } = data;

    const invoice = (await prisma.invoice.findUnique({
      where: { id },
      include: {
        card: CARD_SELECT as never,
        transactions: {
          where: { deleted_at: null },
          select: { amount: true },
        },
      },
    })) as unknown as
      | (Record<string, unknown> & {
          id: string;
          status: InvoiceStatus;
          total_amount: unknown;
          card: any;
          transactions: Array<{ amount: unknown }>;
        })
      | null;

    if (!invoice) throw new NotFoundError('Fatura não encontrada');

    const currentStatus = invoice.status as InvoiceStatus;

    if (currentStatus === 'COMPLETED' && status !== 'COMPLETED') {
      throw new ValidationError('Não é possível alterar o status de uma fatura já concluída');
    }

    const updateData: Record<string, unknown> = { status };

    if (status === 'COMPLETED') {
      updateData.paid_date = effective_date ? parseLocalDate(effective_date) : new Date();
      const calculatedTotal = invoice.transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      const currentTotal = calculatedTotal || Number(invoice.total_amount) || 0;
      const frontendAmount = Number(paid_amount);
      updateData.paid_amount = frontendAmount > 0 ? frontendAmount : currentTotal;
    }

    if (currentStatus === 'COMPLETED' && status === 'PENDING') {
      updateData.paid_date = null;
      updateData.paid_amount = 0;
    }

    // Os lancamentos da fatura recebem status, efetivacao e instituicao.
    const transactionData: Record<string, unknown> = { status };
    if (effective_date) transactionData.effective_date = parseLocalDate(effective_date);
    if (institution_id) transactionData.financial_institution_id = institution_id;

    const [updatedTransactions, updatedInvoice] = await prisma.$transaction(async tx => Promise.all([
      tx.transaction.updateMany({
        where: { invoice_id: id, deleted_at: null },
        data: transactionData,
      }),
      tx.invoice.update({
        where: { id },
        data: updateData,
        include: { card: CARD_SELECT as never },
      }),
    ]));

    return {
      ...updatedInvoice,
      total_amount: Number(updatedInvoice.total_amount ?? 0),
      paid_amount: Number(updatedInvoice.paid_amount ?? 0),
      card: mapCard((updatedInvoice as any).card),
      updated_transactions: updatedTransactions.count,
    } as UpdateInvoiceStatusResult;
  }

  async getTransactions(invoiceId: string): Promise<InvoiceTransaction[]> {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, deleted_at: null },
      select: { id: true },
    });
    if (!invoice) throw new NotFoundError('Fatura não encontrada');

    const transactions = await prisma.transaction.findMany({
      where: { invoice_id: invoiceId, deleted_at: null },
      orderBy: { event_date: 'asc' },
      include: TRANSACTION_INCLUDE as never,
    });

    return transactions.map((t) => this.mapTransaction(t));
  }

  async getByCard(cardId: string, year?: number): Promise<InvoiceByCardItem[]> {
    const where: Record<string, unknown> = { card_id: cardId };
    if (year) where.year = year;

    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: {
        card: CARD_SELECT as never,
        _count: {
          select: { transactions: { where: { deleted_at: null } } },
        },
      },
    });

    return invoices.map((inv) => ({
      ...inv,
      total_amount: Number(inv.total_amount ?? 0),
      paid_amount: Number(inv.paid_amount ?? 0),
      card: mapCard((inv as any).card),
      transaction_count: (inv as any)._count?.transactions ?? 0,
    })) as unknown as InvoiceByCardItem[];
  }

  private mapTransaction(t: any): InvoiceTransaction {
    return {
      id: t.id,
      description: t.description,
      amount: Number(t.amount ?? 0),
      event_date: t.event_date,
      effective_date: t.effective_date,
      status: t.status as InvoiceStatus,
      installment_number: t.installment_number,
      total_installments: t.total_installments,
      category: t.category ? { id: t.category.id, name: t.category.name } : null,
      supplier: t.supplier ? { id: t.supplier.id, legal_name: t.supplier.legal_name } : null,
    };
  }
}
