import { z } from 'zod';
import { ValidationError } from '@/core/errors/domain-errors';

/**
 * Validação do módulo Leases — porte de `lib/validators/lease.ts`.
 *
 * ⚠️ Diferente dos outros módulos: o `LeaseValidator` original retorna
 * `{ isValid, errors, warnings }` — `warnings` são avisos não-bloqueantes
 * (ex: parcelas de IPTU não batem com o valor base) que o backend devolve
 * junto da resposta de sucesso. Reproduzido aqui como função dedicada em vez
 * de um schema Zod puro, porque a lógica de warnings é condicional e não deve
 * impedir o submit.
 *
 * Camada: shared.
 * Origem: api-nairim-v2/src/lib/validators/lease.ts.
 */

const guarantorSchema = z.record(z.string(), z.unknown());

export const createLeaseSchema = z.object({
  property_id: z.string().trim().min(1, 'ID da propriedade é obrigatório'),
  type_id: z.string().trim().min(1, 'Tipo de propriedade é obrigatório'),
  owner_id: z.string().trim().min(1, 'ID do proprietário é obrigatório'),
  tenant_id: z.string().trim().min(1, 'ID do inquilino é obrigatório'),
  agency_id: z.string().nullish(),
  financial_institution_id: z.string().nullish(),
  contract_number: z.string().trim().min(1, 'Número do contrato é obrigatório'),
  start_date: z.union([z.string(), z.date()]),
  end_date: z.union([z.string(), z.date()]),
  rent_amount: z.union([z.number(), z.string()]).optional(),
  condo_fee: z.union([z.number(), z.string()]).nullish(),
  property_tax: z.union([z.number(), z.string()]).nullish(),
  extra_charges: z.union([z.number(), z.string()]).nullish(),
  discount_amount: z.union([z.number(), z.string()]).nullish(),
  commission_amount: z.union([z.number(), z.string()]).nullish(),
  rent_due_day: z.union([z.number(), z.string()]),
  tax_due_day: z.union([z.number(), z.string()]).nullish(),
  condo_due_day: z.union([z.number(), z.string()]).nullish(),
  status: z.string().optional(),
  payment_condition: z.enum(['IN_FULL_15_DISCOUNT', 'SECOND_INSTALLMENT_10_DISCOUNT', 'INSTALLMENTS']).nullish(),
  property_tax_cash: z.union([z.number(), z.string()]).nullish(),
  property_tax_cash_due_date: z.union([z.string(), z.date()]).nullish(),
  property_tax_first_installment: z.union([z.number(), z.string()]).nullish(),
  property_tax_first_installment_due_date: z.union([z.string(), z.date()]).nullish(),
  property_tax_second_installment: z.union([z.number(), z.string()]).nullish(),
  property_tax_second_installment_due_date: z.union([z.string(), z.date()]).nullish(),
  iptu_year: z.union([z.number(), z.string()]).nullish(),
  iptu_installments: z.array(z.union([z.number(), z.string()])).nullish(),
  iptu_installments_due_dates: z.array(z.string().nullish()).nullish(),
  iptu_installments_count: z.union([z.number(), z.string()]).nullish(),
  insurance_company: z.string().nullish(),
  insurance_type: z.string().nullish(),
  insurance_policy: z.string().nullish(),
  guarantors: z.array(guarantorSchema).nullish(),
  cancellation_justification: z.string().nullish(),
  cancellation_penalty: z.union([z.number(), z.string()]).nullish(),
  other_cancellation_amounts: z.union([z.number(), z.string()]).nullish(),
  canceled_at: z.union([z.string(), z.date()]).nullish(),
}).passthrough();

export const updateLeaseSchema = createLeaseSchema.partial();

export const listLeasesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(150).default(150),
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().optional(),
});

/** Converte valores monetários em BR (vírgula) ou US (ponto) para number. Porte de `parseDecimal`. */
function parseDecimal(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  const strValue = String(value).trim();
  if (!strValue.includes(',') && strValue.includes('.')) {
    const parsed = parseFloat(strValue);
    if (!isNaN(parsed)) return parsed;
  }
  const cleaned = strValue.replace(/[^\d,-]/g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

/**
 * Valida as condições de pagamento de IPTU, retornando avisos não-bloqueantes
 * (nunca `errors`) — idêntico a `LeaseValidator.validateIptuConditions`.
 */
function validateIptuConditions(data: Record<string, unknown>): string[] {
  const warnings: string[] = [];
  const baseIptu = parseDecimal(data.property_tax);

  if (!baseIptu || baseIptu <= 0) {
    if (data.payment_condition) {
      warnings.push('Para configurar as opções de pagamento, preencha o "Valor do IPTU (Base)" primeiro.');
    }
    return warnings;
  }

  const formattedBase = brl(baseIptu);

  if (data.payment_condition === 'IN_FULL_15_DISCOUNT') {
    const cashVal = parseDecimal(data.property_tax_cash);
    const minExpectedVal = baseIptu * 0.85;
    const maxExpectedVal = baseIptu;

    if (!cashVal || cashVal <= 0) {
      warnings.push('Por favor, informe o valor da cobrança à vista.');
    } else if (cashVal < minExpectedVal - 0.1 || cashVal > maxExpectedVal + 0.1) {
      warnings.push(`O valor à vista informado (${brl(cashVal)}) não é válido. O limite permitido é entre ${brl(minExpectedVal)} (aplicando 15% de desconto) e ${formattedBase} (sem desconto).`);
    }
  } else if (data.payment_condition === 'SECOND_INSTALLMENT_10_DISCOUNT') {
    const firstVal = parseDecimal(data.property_tax_first_installment);
    const secondVal = parseDecimal(data.property_tax_second_installment);
    const total = firstVal + secondVal;
    const minExpectedTotal = baseIptu * 0.9;
    const maxExpectedTotal = baseIptu;

    if (!firstVal || firstVal <= 0) warnings.push('Por favor, informe o valor da 1ª Parcela.');
    if (!secondVal || secondVal <= 0) warnings.push('Por favor, informe o valor da 2ª Parcela.');

    if (firstVal > 0 && secondVal > 0 && (total < minExpectedTotal - 0.1 || total > maxExpectedTotal + 0.1)) {
      warnings.push(`A soma das duas parcelas (${brl(total)}) não é válida. O total deve ficar entre ${brl(minExpectedTotal)} (aplicando 10% de desconto) e ${formattedBase} (sem desconto).`);
    }
  } else if (data.payment_condition === 'INSTALLMENTS') {
    const installments = data.iptu_installments;
    if (!Array.isArray(installments) || installments.length === 0) {
      warnings.push('Por favor, preencha os valores de todas as parcelas no detalhamento.');
      return warnings;
    }

    let totalInstallments = 0;
    for (const val of installments) {
      const numVal = parseDecimal(val);
      if (numVal <= 0) {
        warnings.push('Todas as parcelas do IPTU devem ter um valor maior que zero.');
        return warnings;
      }
      totalInstallments += numVal;
    }

    const diff = Math.abs(baseIptu - totalInstallments);
    if (diff > 0.1) {
      const diferencaMsg = totalInstallments > baseIptu
        ? `Passou ${brl(totalInstallments - baseIptu)} do valor correto`
        : `Falta ${brl(baseIptu - totalInstallments)} para fechar o valor correto`;
      warnings.push(`A soma das parcelas informadas (${brl(totalInstallments)}) está diferente do valor base do IPTU (${formattedBase}). ${diferencaMsg}. Ajuste as parcelas para bater a conta exata.`);
    }
  }

  return warnings;
}

/**
 * Valida create/update de locação: campos obrigatórios (Zod) + regras
 * adicionais de data/IPTU (fiéis ao `LeaseValidator`).
 * @returns os `warnings` não-bloqueantes a anexar na resposta de sucesso.
 * @throws ValidationError se houver erro bloqueante.
 */
export function validateLeaseBusinessRules(data: Record<string, unknown>, isUpdate: boolean): string[] {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isUpdate) {
    if (data.rent_amount === undefined || data.rent_amount === null) warnings.push('Valor do aluguel não foi informado');
    if (data.rent_due_day === undefined || data.rent_due_day === null) errors.push('Dia de vencimento do aluguel é obrigatório');
  }

  if (data.start_date && data.end_date) {
    const startDate = new Date(data.start_date as string);
    const endDate = new Date(data.end_date as string);
    if (startDate >= endDate) errors.push('Data de início deve ser anterior à data de término');
  }

  if (data.payment_condition && !['IN_FULL_15_DISCOUNT', 'SECOND_INSTALLMENT_10_DISCOUNT', 'INSTALLMENTS'].includes(data.payment_condition as string)) {
    errors.push('Condição de pagamento inválida');
  }

  warnings.push(...validateIptuConditions(data));

  if (errors.length > 0) throw new ValidationError('Erro de validação', errors);
  return warnings;
}
