import { z } from 'zod';

/**
 * Schemas Zod do módulo Investimentos (tela "Meus Investimentos").
 * Substituem a leitura crua do payload nas Server Actions.
 *
 * Camada: shared.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export const investmentProductTypeSchema = z.enum([
  'CDB',
  'RDB',
  'LCI',
  'LCA',
  'LC',
  'LF',
  'TESOURO_DIRETO',
  'POUPANCA',
  'DEBENTURE',
  'CRI',
  'CRA',
  'COE',
  'FUNDO',
  'PREVIDENCIA',
  'ACAO',
  'FII',
  'ETF',
  'BDR',
  'CRIPTO',
  'OUTRO',
]);

export const createInvestmentSchema = z.object({
  financial_institution_id: z.string().min(1, 'A instituição financeira é obrigatória'),
  partition: z.string().nullish(),
  issuer: z.string().min(1, 'O emissor é obrigatório'),
  product_type: investmentProductTypeSchema,
  product: z.string().min(1, 'O produto é obrigatório'),
  application_date: z.string().regex(ISO_DATE, 'A data da aplicação deve estar no formato AAAA-MM-DD'),
  maturity_date: z.string().regex(ISO_DATE, 'O vencimento deve estar no formato AAAA-MM-DD').nullish(),
  liquidity_days: z.number().int().nonnegative().nullish(),
  liquidity_at_maturity: z.boolean().optional(),
  invested_amount: z.number().positive('O valor investido deve ser maior que zero'),
  notes: z.string().nullish(),
});

export const updateInvestmentSchema = createInvestmentSchema.partial().extend({
  liquidated_at: z.string().regex(ISO_DATE, 'A data de liquidação deve estar no formato AAAA-MM-DD').nullish(),
});

export const investmentDashboardQuerySchema = z
  .object({
    startMonth: z.string().regex(ISO_MONTH, 'O mês inicial deve estar no formato AAAA-MM'),
    endMonth: z.string().regex(ISO_MONTH, 'O mês final deve estar no formato AAAA-MM'),
  })
  .passthrough()
  .refine((value) => value.startMonth <= value.endMonth, {
    message: 'O mês inicial não pode ser maior que o mês final',
    path: ['startMonth'],
  });

export const investmentReorderSchema = z.object({
  ordered_ids: z.array(z.string().min(1)).min(1, 'Informe a nova ordem dos investimentos'),
});

export const investmentNotesSchema = z.object({
  id: z.string().min(1, 'O ID é obrigatório'),
  notes: z.string().nullish(),
});

export const investmentTransactionSchema = z.object({
  investment_id: z.string().min(1, 'O investimento é obrigatório'),
  type: z.enum(['CONTRIBUTION', 'REDEMPTION']).optional(),
  date: z.string().regex(ISO_DATE, 'A data deve estar no formato AAAA-MM-DD'),
  amount: z.number().positive('O valor deve ser maior que zero'),
});

export const investmentTransactionUpdateSchema = investmentTransactionSchema.omit({ investment_id: true });

export const investmentTransactionListSchema = z.object({
  investment_id: z.string().min(1, 'O investimento é obrigatório'),
  year: z.number().int().min(1900).max(2999),
  month: z.number().int().min(1).max(12),
});

export const investmentMonthBalanceSchema = z.object({
  investment_id: z.string().min(1, 'O investimento é obrigatório'),
  year: z.number().int().min(1900).max(2999),
  month: z.number().int().min(1).max(12),
  /** null limpa o saldo informado — o mês volta a herdar do anterior. */
  balance: z.number().nonnegative('O saldo do mês deve ser um valor não negativo').nullable(),
});

export const investmentSettingsSchema = z.object({
  independence_reference_amount: z
    .number()
    .nonnegative('O valor de referência deve ser um valor não negativo')
    .nullable(),
});
