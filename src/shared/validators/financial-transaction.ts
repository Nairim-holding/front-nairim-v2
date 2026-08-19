import { z } from 'zod';

/**
 * Schemas Zod do módulo Lançamento financeiro (Transaction) — substituem
 * `lib/validators/transaction.ts` (TransactionValidator) do Express.
 *
 * Fidelidade: validações replicam `TransactionValidator` + regras dos
 * controllers (create/update/installments/recurring). `propagate_fields`
 * continua como lista livre aqui; a whitelist é aplicada no use-case
 * (`sanitizePropagateFields`).
 *
 * Camada: shared.
 * Origem: api-nairim-v2/src/lib/validators/transaction.ts.
 */

const TRANSACTION_STATUSES = ['PENDING', 'COMPLETED'] as const;

const FREQUENCIES = [
  'WEEKLY',
  'BIWEEKLY',
  'MONTHLY',
  'BIMONTHLY',
  'QUARTERLY',
  'SEMIANNUAL',
  'YEARLY',
] as const;

/** Converte valor monetário (número ou "R$ 1.234,56"/"1234.56") em number. */
const amountParser = z.preprocess((value) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const clean = value.replace(/[R$\s]/g, '').replace(',', '.');
    const parsed = parseFloat(clean);
    return Number.isNaN(parsed) ? NaN : parsed;
  }
  return NaN;
}, z.number());

const nullableId = z.union([z.string(), z.null()]).optional();

/** Data de efetivação da transação — obrigatória no create. */
const dateRequired = z.string().min(1, 'A Data é obrigatória');

export const createFinancialTransactionSchema = z.object({
  event_date: dateRequired,
  effective_date: dateRequired,
  description: z.union([z.string(), z.null()]).optional(),
  amount: amountParser,
  status: z.enum(TRANSACTION_STATUSES).optional(),
  category_id: z.string().trim().min(1, 'A Categoria é obrigatória'),
  subcategory_id: nullableId,
  financial_institution_id: z.string().trim().min(1, 'A Instituição Financeira é obrigatória'),
  card_id: nullableId,
  center_id: nullableId,
  supplier_id: nullableId,
});

/** Update: todos os campos opcionais + propagação de série. */
export const updateFinancialTransactionSchema = createFinancialTransactionSchema
  .partial()
  .extend({
    propagate_to_following: z.boolean().optional(),
    propagate_fields: z.array(z.string()).optional(),
  });

export const listFinancialTransactionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(150).default(150),
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().optional(),
  includeInactive: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === true || v === 'true'),
});

/** Transferência entre contas (TransferService). */
export const createTransferSchema = z
  .object({
    financial_institution_id: z.string().trim().min(1, 'A conta de origem é obrigatória.'),
    destination_institution_id: z.string().trim().min(1, 'A conta de destino é obrigatória.'),
    destination_center_id: z.string().trim().min(1, 'O Centro de Receita de destino é obrigatório.'),
    amount: z.preprocess((v) => {
      if (typeof v === 'number') return v;
      if (typeof v === 'string') {
        const parsed = parseFloat(v.replace(/[R$\s]/g, '').replace(',', '.'));
        return Number.isNaN(parsed) ? NaN : parsed;
      }
      return NaN;
    }, z.number().positive('Valor da transferência deve ser maior que zero.')),
    event_date: dateRequired,
    effective_date: dateRequired,
    description: z.union([z.string(), z.null()]).optional(),
    status: z.enum(TRANSACTION_STATUSES).optional(),
    category_id: z.string().trim().min(1, 'A Categoria é obrigatória'),
    center_id: nullableId,
    supplier_id: nullableId,
  })
  .refine((data) => String(data.financial_institution_id) !== String(data.destination_institution_id), {
    message: 'A conta de destino deve ser diferente da conta de origem.',
    path: ['destination_institution_id'],
  });

/** Parcelado (ParceladoRecorrenteModal) — TransactionValidator.validateInstallments. */
export const createInstallmentsSchema = z
  .object({
    transaction_type: z.enum(['INCOME', 'EXPENSE']).default('EXPENSE'),
    institution_id: z.union([z.string(), z.null()]).optional(),
    category_id: z.string().trim().min(1, 'A Categoria é obrigatória'),
    subcategory_id: nullableId,
    card_id: nullableId,
    center_id: nullableId,
    supplier_id: nullableId,
    description: z.union([z.string(), z.null()]).optional(),
    installment_amount: amountParser,
    num_installments: z.coerce.number().int(),
    total_amount: amountParser,
    start_date: dateRequired,
    first_payment_date: dateRequired,
  })
  .superRefine((val, ctx) => {
    if (val.num_installments < 2 || val.num_installments > 120) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['num_installments'],
        message: 'O Número de Parcelas deve estar entre 2 e 120',
      });
    }
    const expectedTotal = val.installment_amount * val.num_installments;
    if (expectedTotal > 0 && Math.abs(val.total_amount - expectedTotal) > 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['total_amount'],
        message: `Total inválido: esperado ${expectedTotal.toFixed(2)}, recebido ${val.total_amount.toFixed(2)}`,
      });
    }
    const firstPayment = new Date(val.first_payment_date);
    const startDate = new Date(val.start_date);
    if (!Number.isNaN(firstPayment.getTime()) && !Number.isNaN(startDate.getTime()) && firstPayment < startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['first_payment_date'],
        message: 'A Data do Primeiro Pagamento deve ser igual ou posterior à Data de Início',
      });
    }
  });

const zId = z.union([z.string(), z.null()]);

/** Recorrência (modelo único config-based) — campos do ParceladoRecorrenteModal. */
export const createRecurrenceSchema = z
  .object({
    transaction_type: z.enum(['INCOME', 'EXPENSE']).optional(),
    frequency: z.enum(FREQUENCIES).default('MONTHLY'),
    institution_id: zId,
    category_id: z.string().trim().min(1, 'A Categoria é obrigatória'),
    subcategory_id: nullableId,
    card_id: nullableId,
    center_id: nullableId,
    supplier_id: nullableId,
    description: z.union([z.string(), z.null()]).optional(),
    amount: amountParser,
    start_date: dateRequired,
    first_payment_date: dateRequired,
  })
  .superRefine((val, ctx) => {
    if (val.institution_id == null || val.institution_id === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['institution_id'],
        message: 'A Instituição Financeira é obrigatória',
      });
    }
    const firstPayment = new Date(val.first_payment_date);
    const startDate = new Date(val.start_date);
    if (!Number.isNaN(firstPayment.getTime()) && !Number.isNaN(startDate.getTime()) && firstPayment < startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['first_payment_date'],
        message: 'A Data do Primeiro Pagamento deve ser igual ou posterior à Data de Início',
      });
    }
  });