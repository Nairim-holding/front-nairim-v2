import { z } from 'zod';

/**
 * Schemas Zod do modulo Fatura de Cartao (Invoice) — substituem as validacoes
 * do `InvoiceController` (Express).
 *
 * Fidelidade: mes 1..12, ano 2000..2100, status PENDING|COMPLETED,
 * `effective_date` em YYYY-MM-DD (quando informada). Datas opcionais passam
 * vazias/null como `undefined` para o repository nao recalcular por engano.
 *
 * Camada: shared.
 * Origem: api-nairim-v2/src/controllers/InvoiceController.ts.
 */

const monthParams = z.coerce.number().int().min(1, 'Mês deve ser entre 1 e 12').max(12, 'Mês deve ser entre 1 e 12');
const yearParams = z.coerce.number().int().min(2000, 'Ano inválido').max(2100, 'Ano inválido');

const optionalDateString = z
  .union([z.string(), z.null(), z.literal(''), z.undefined()])
  .optional()
  .transform((v) => (v === '' || v === null ? undefined : v))
  .pipe(z.string().optional());

/** GET /financial-invoice?cardId&month&year. */
export const getInvoiceQuerySchema = z.object({
  cardId: z.string().trim().min(1, 'cardId é obrigatório'),
  month: monthParams,
  year: yearParams,
});

/** POST /financial-invoice */
export const createInvoiceSchema = z.object({
  card_id: z.string().trim().min(1, 'card_id é obrigatório'),
  month: monthParams,
  year: yearParams,
  closing_date: optionalDateString,
  due_date: optionalDateString,
});

/** PUT /financial-invoice/:id/status */
const paidAmountParser = z
  .union([z.number(), z.string(), z.null(), z.literal(''), z.undefined()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === null || v === '') return undefined;
    const n = Number(String(v).replace(/[^\d.-]/g, ''));
    return Number.isNaN(n) ? undefined : n;
  });

export const updateInvoiceStatusSchema = z.object({
  status: z.enum(['PENDING', 'COMPLETED'], { message: 'Status inválido. Use: PENDING ou COMPLETED' }),
  effective_date: optionalDateString,
  paid_amount: paidAmountParser,
  institution_id: z
    .union([z.string(), z.null(), z.literal(''), z.undefined()])
    .optional()
    .transform((v) => (v === null || v === '' ? undefined : v)),
});

/** GET /financial-invoice/card/:cardId?year= */
export const getInvoicesByCardSchema = z.object({
  cardId: z.string().trim().min(1, 'cardId é obrigatório'),
  year: z
    .union([z.literal(''), z.undefined(), z.number()])
    .optional()
    .transform((v) => (v === undefined || v === '' ? undefined : Number(v)))
    .pipe(z.number().int().min(2000, 'Ano inválido').max(2100, 'Ano inválido').optional()),
});