import { z } from 'zod';

/**
 * Schemas Zod dos endpoints de relatório financeiro (Módulo 9g/11).
 * Substituem os `req.query` lidos no TransactionController:
 *  - `/monthly-summary?year=YYYY`
 *  - `/monthly-summary-multi?years=YYYY&years=YYYY`
 *  - `/available-years`
 *  - `/expense-by-category?startDate=&endDate=`
 *  - `/subcategory-breakdown?categoryId=&startDate=&endDate=`
 *
 * Fidelidade: os controllers não validavam os filtros (Tarefa 5.1), apenas os
 * campos-chave. Aqui aceitamos `unknown` como fallback e validamos o essencial.
 */

export const monthlySummaryQuerySchema = z
  .object({
    year: z.coerce.number().int().min(1).default(new Date().getFullYear()),
  })
  .passthrough();

export const monthlySummaryMultiQuerySchema = z.object({}).passthrough();

export const expenseByCategoryQuerySchema = z
  .object({
    startDate: z.string().min(1, 'startDate é obrigatório'),
    endDate: z.string().min(1, 'endDate é obrigatório'),
  })
  .passthrough();

export const subcategoryBreakdownQuerySchema = z
  .object({
    categoryId: z.string().min(1, 'categoryId é obrigatório'),
    startDate: z.string().min(1, 'startDate é obrigatório'),
    endDate: z.string().min(1, 'endDate é obrigatório'),
  })
  .passthrough();

/** Extrai os anos de `?years=2024&years=2025` ou `?year=` repetido. */
export function parseMultiYears(raw: Record<string, unknown>): number[] {
  const rawValue = raw?.years ?? raw?.year;
  if (rawValue === undefined) return [];
  const values = Array.isArray(rawValue) ? rawValue : [rawValue];
  return values
    .flatMap((v) => String(v ?? '').split(','))
    .map((v) => parseInt(v.trim(), 10))
    .filter((v) => !Number.isNaN(v));
}