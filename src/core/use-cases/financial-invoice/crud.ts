import type { InvoicesRepository } from '@/core/repositories/financial-invoices-repository';
import type {
  CreateInvoiceData,
  GetInvoiceParams,
  InvoiceByCardItem,
  InvoiceStatus,
  InvoiceTransaction,
  InvoiceWithRelations,
  UpdateInvoiceStatusData,
  UpdateInvoiceStatusResult,
} from '@/core/entities/financial-invoice';
import { ValidationError } from '@/core/errors/domain-errors';

/**
 * Casos de uso de Fatura de cartao.
 * Camada: core.
 * Origem: api-nairim-v2/src/services/InvoiceService.ts + InvoiceController.
 * Rodam dentro do contexto de tenant (withTenant).
 *
 * FIDELIDADE: mensagens/status replicam o backend — cartao inexistente (404),
 * fatura duplicada (409), fatura ja concluida (400), status invalido (400).
 */

const INVOICE_STATUSES: InvoiceStatus[] = ['PENDING', 'COMPLETED'];

function isMonthValid(month: number): boolean {
  return Number.isInteger(month) && month >= 1 && month <= 12;
}

function isYearValid(year: number): boolean {
  return Number.isInteger(year) && year >= 2000 && year <= 2100;
}

export class GetInvoiceByCardAndMonthUseCase {
  constructor(private readonly invoices: InvoicesRepository) {}
  async execute(params: GetInvoiceParams): Promise<InvoiceWithRelations | null> {
    if (!params.cardId?.trim()) throw new ValidationError('cardId é obrigatório');
    if (!isMonthValid(params.month)) throw new ValidationError('Mês inválido. Deve ser entre 1 e 12');
    if (!isYearValid(params.year)) throw new ValidationError('Ano inválido');
    return this.invoices.getByCardAndMonth(params);
  }
}

export class CreateInvoiceUseCase {
  constructor(private readonly invoices: InvoicesRepository) {}
  async execute(data: CreateInvoiceData): Promise<InvoiceWithRelations> {
    if (!data.card_id?.trim()) throw new ValidationError('card_id é obrigatório');
    if (!isMonthValid(data.month)) throw new ValidationError('Mês inválido. Deve ser entre 1 e 12');
    if (!isYearValid(data.year)) throw new ValidationError('Ano inválido');
    return this.invoices.create(data);
  }
}

export class UpdateInvoiceStatusUseCase {
  constructor(private readonly invoices: InvoicesRepository) {}
  async execute(id: string, data: UpdateInvoiceStatusData): Promise<UpdateInvoiceStatusResult> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    if (!data.status || !INVOICE_STATUSES.includes(data.status)) {
      throw new ValidationError('Status inválido. Use: PENDING ou COMPLETED');
    }
    if (
      data.effective_date !== undefined &&
      data.effective_date !== null &&
      data.effective_date !== '' &&
      !/^\d{4}-\d{2}-\d{2}/.test(data.effective_date)
    ) {
      throw new ValidationError('Data de Efetivação inválida. Use o formato YYYY-MM-DD');
    }
    if (data.paid_amount !== undefined && data.paid_amount !== null && isNaN(Number(data.paid_amount))) {
      throw new ValidationError('O valor pago deve ser numérico');
    }
    return this.invoices.updateStatus(id, data);
  }
}

export class GetInvoiceTransactionsUseCase {
  constructor(private readonly invoices: InvoicesRepository) {}
  async execute(invoiceId: string): Promise<InvoiceTransaction[]> {
    if (!invoiceId) throw new ValidationError('O ID é obrigatório');
    return this.invoices.getTransactions(invoiceId);
  }
}

export class GetInvoicesByCardUseCase {
  constructor(private readonly invoices: InvoicesRepository) {}
  async execute(cardId: string, year?: number): Promise<InvoiceByCardItem[]> {
    if (!cardId?.trim()) throw new ValidationError('cardId é obrigatório');
    if (year !== undefined && !isYearValid(year)) throw new ValidationError('Ano inválido');
    return this.invoices.getByCard(cardId, year);
  }
}