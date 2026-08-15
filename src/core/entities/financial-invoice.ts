/**
 * Entidades de dominio: Fatura de cartao (Invoice) e agregados usados pelo
 * Modulo 9h.
 *
 * Fidelidade ao backend (InvoiceService):
 *  - getInvoice recalcula `total_amount` a partir das transacoes da fatura e
 *    atualiza o registro quando divergente.
 *  - createInvoice valida cartao e unicidade em (card_id, month, year), e
 *    calcula closing/due date a partir dos dias do cartao quando nao fornecidos.
 *  - updateStatus atualiza STATUS/propagacao dos lancamentos (status, data de
 *    efetivacao e instituicao) numa unica transacao de banco.
 *  - getInvoicesByCard ordena ano/mes desc e anexa transaction_count.
 *
 * Camada: core. Origem: model `Invoice` (prisma/schema.prisma) e
 * api-n airir-v2/src/services/InvoiceService.ts.
 */

export type InvoiceStatus = 'PENDING' | 'COMPLETED';

/** Cartao embutido nas leituras de fatura. */
export interface InvoiceCard {
  id: string;
  name: string;
  brand: string;
  limit: number;
  closing_day: number | null;
  due_day: number | null;
}

/** Lancamento sinalizado na fatura (relacoes anexadas). */
export interface InvoiceTransaction {
  id: string;
  description: string;
  amount: number;
  event_date: Date;
  effective_date: Date;
  status: InvoiceStatus;
  installment_number: number | null;
  total_installments: number | null;
  category: { id: string; name: string } | null;
  supplier: { id: string; legal_name: string } | null;
}

/** Registro de fatura com relacoes anexadas. */
export interface Invoice {
  id: string;
  company_id: string;
  card_id: string;
  month: number;
  year: number;
  total_amount: number;
  status: InvoiceStatus;
  closing_date: Date | null;
  due_date: Date | null;
  paid_date: Date | null;
  paid_amount: number;
  institution_id: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  /** Registro em memória pode carregar campos extras do Prisma. */
  [key: string]: unknown;
}

/** Fatura com cartao embutido (create/update/status). */
export interface InvoiceWithCard extends Invoice {
  card: InvoiceCard;
}

/** Fatura com cartao + lancamentos (GET por card/mes/ano). */
export interface InvoiceWithRelations extends InvoiceWithCard {
  transactions: InvoiceTransaction[];
}

/** Item da listagem por cartao (GET /card/:cardId). */
export interface InvoiceByCardItem extends InvoiceWithCard {
  transaction_count: number;
}

/** Entrada de criacao — obrigatorios: card_id, month, year. */
export interface CreateInvoiceData {
  card_id: string;
  month: number;
  year: number;
  closing_date?: string;
  due_date?: string;
}

/** Entrada de atualizacao de status (PUT /:id/status). */
export interface UpdateInvoiceStatusData {
  status: InvoiceStatus;
  effective_date?: string;
  paid_amount?: number;
  institution_id?: string;
}

/** Parametros de busca unica (GET ?cardId&month&year). */
export interface GetInvoiceParams {
  cardId: string;
  month: number;
  year: number;
}

/** Retorno do updateStatus: fatura + quantos lancamentos foram tocados. */
export interface UpdateInvoiceStatusResult extends InvoiceWithCard {
  updated_transactions: number;
}