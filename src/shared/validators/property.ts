import { z } from 'zod';

/**
 * Schemas Zod do módulo Properties (fluxo unificado) — substituem
 * `lib/validators/property.ts` (`validateCreate`/`validateUpdate`).
 *
 * Camada: shared. Origem: api-nairim-v2/src/lib/validators/property.ts.
 */

const addressSchema = z.object({
  zip_code: z.string().trim().min(1, 'CEP é obrigatório'),
  street: z.string().trim().min(1, 'Rua é obrigatória'),
  number: z.string().trim().min(1, 'Número é obrigatório'),
  complement: z.string().nullish(),
  block: z.string().nullish(),
  lot: z.string().nullish(),
  district: z.string().trim().min(1, 'Bairro é obrigatório'),
  city: z.string().trim().min(1, 'Cidade é obrigatória'),
  state: z.string().trim().min(1, 'Estado é obrigatório'),
  country: z.string().nullish(),
  latitude: z.union([z.number(), z.string()]).nullish(),
  longitude: z.union([z.number(), z.string()]).nullish(),
});

const valuesSchema = z.object({
  purchase_date: z.union([z.string(), z.date()]).nullish(),
  purchase_value: z.union([z.number(), z.string()]).nullish(),
  market_value: z.union([z.number(), z.string()]).nullish(),
  rental_value: z.union([z.number(), z.string()]).nullish(),
  condo_fee: z.union([z.number(), z.string()]).nullish(),
  property_tax: z.union([z.number(), z.string()]).nullish(),
  status: z.string().min(1, 'Status da propriedade é obrigatório'),
  notes: z.string().nullish(),
  sale_date: z.union([z.string(), z.date()]).nullish(),
  sale_value: z.union([z.number(), z.string()]).nullish(),
  extra_charges: z.union([z.number(), z.string()]).nullish(),
});

/** IPTU: exigências condicionais por `payment_condition`, fiéis ao backend. */
const iptuSchema = z
  .object({
    id: z.string().optional(),
    year: z.union([z.number(), z.string()]),
    payment_condition: z.string().nullish(),
    property_tax: z.union([z.number(), z.string()]).nullish(),
    property_tax_cash: z.union([z.number(), z.string()]).nullish(),
    property_tax_cash_due_date: z.union([z.string(), z.date()]).nullish(),
    property_tax_first_installment: z.union([z.number(), z.string()]).nullish(),
    property_tax_first_installment_due_date: z.union([z.string(), z.date()]).nullish(),
    property_tax_second_installment: z.union([z.number(), z.string()]).nullish(),
    property_tax_second_installment_due_date: z.union([z.string(), z.date()]).nullish(),
    iptu_installments_count: z.union([z.number(), z.string()]).nullish(),
    iptu_installments: z.array(z.unknown()).nullish(),
  })
  .superRefine((iptu, ctx) => {
    if (!iptu.year || isNaN(parseInt(String(iptu.year)))) {
      ctx.addIssue({ code: 'custom', message: 'O ano é obrigatório', path: ['year'] });
    }
    if (iptu.payment_condition === 'IN_FULL_15_DISCOUNT') {
      if (!iptu.property_tax_cash) ctx.addIssue({ code: 'custom', message: 'Valor da cota única é obrigatório', path: ['property_tax_cash'] });
      if (!iptu.property_tax_cash_due_date) ctx.addIssue({ code: 'custom', message: 'Data de vencimento da cota única é obrigatória', path: ['property_tax_cash_due_date'] });
    } else if (iptu.payment_condition === 'SECOND_INSTALLMENT_10_DISCOUNT') {
      if (!iptu.property_tax_first_installment) ctx.addIssue({ code: 'custom', message: 'Valor da 1ª parcela é obrigatório', path: ['property_tax_first_installment'] });
      if (!iptu.property_tax_first_installment_due_date) ctx.addIssue({ code: 'custom', message: 'Data de vencimento da 1ª parcela é obrigatória', path: ['property_tax_first_installment_due_date'] });
      if (!iptu.property_tax_second_installment) ctx.addIssue({ code: 'custom', message: 'Valor da 2ª cota é obrigatório', path: ['property_tax_second_installment'] });
      if (!iptu.property_tax_second_installment_due_date) ctx.addIssue({ code: 'custom', message: 'Data de vencimento da 2ª cota é obrigatória', path: ['property_tax_second_installment_due_date'] });
    } else if (iptu.payment_condition === 'INSTALLMENTS') {
      if (!iptu.iptu_installments_count) ctx.addIssue({ code: 'custom', message: 'Quantidade de parcelas é obrigatória', path: ['iptu_installments_count'] });
      if (!Array.isArray(iptu.iptu_installments) || iptu.iptu_installments.length === 0) {
        ctx.addIssue({ code: 'custom', message: 'Parcelas são obrigatórias', path: ['iptu_installments'] });
      }
    }
  });

export const createUnifiedPropertySchema = z.object({
  title: z.string().trim().min(1, 'Título é obrigatório'),
  registration_number: z.string().nullish(),
  bedrooms: z.union([z.number(), z.string()]),
  bathrooms: z.union([z.number(), z.string()]),
  half_bathrooms: z.union([z.number(), z.string()]).optional(),
  garage_spaces: z.union([z.number(), z.string()]).optional(),
  area_total: z.union([z.number(), z.string()]),
  area_built: z.union([z.number(), z.string()]).optional(),
  frontage: z.union([z.number(), z.string()]).optional(),
  furnished: z.union([z.boolean(), z.string()]),
  // Checkbox do formulário chega como boolean, mas o FormData pode entregar
  // 'true'/'false'; normaliza aqui para o repositório receber sempre boolean —
  // `Boolean('false')` seria `true` e marcaria IRRF em imóvel desmarcado.
  income_tax_withholding: z.union([z.boolean(), z.string()]).optional().transform((v) => v === true || v === 'true'),
  floor_number: z.union([z.number(), z.string()]).nullish(),
  tax_registration: z.string().trim().min(1, 'Registro de imposto é obrigatório'),
  notes: z.string().nullish(),
  owner_id: z.string().trim().min(1, 'Proprietário é obrigatório'),
  type_id: z.string().trim().min(1, 'Tipo de propriedade é obrigatório'),
  agency_id: z.string().nullish(),
  center_id: z.string().nullish(),
  debit_center_id: z.string().nullish(),
  category_id: z.string().nullish(),
  subcategory_id: z.string().nullish(),
  iptu_refund_category_id: z.string().nullish(),
  iptu_refund_subcategory_id: z.string().nullish(),
  address: addressSchema.optional(),
  values: valuesSchema.optional(),
  iptus: z.array(iptuSchema).optional(),
}).superRefine((data, ctx) => {
  if (data.bedrooms === undefined || data.bedrooms === null || isNaN(Number(data.bedrooms))) {
    ctx.addIssue({ code: 'custom', message: 'Número de quartos é obrigatório', path: ['bedrooms'] });
  }
  if (data.bathrooms === undefined || data.bathrooms === null || isNaN(Number(data.bathrooms))) {
    ctx.addIssue({ code: 'custom', message: 'Número de banheiros é obrigatório', path: ['bathrooms'] });
  }
  if (data.area_total === undefined || data.area_total === null || isNaN(Number(data.area_total))) {
    ctx.addIssue({ code: 'custom', message: 'Área total é obrigatória', path: ['area_total'] });
  }
});

/** Update: mesma forma do create (o front sempre envia o objeto completo no fluxo unificado). */
export const updateUnifiedPropertySchema = createUnifiedPropertySchema;

export const listPropertiesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(150).default(150),
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().optional(),
  includeInactive: z.union([z.boolean(), z.string()]).optional().transform((v) => v === true || v === 'true'),
});
