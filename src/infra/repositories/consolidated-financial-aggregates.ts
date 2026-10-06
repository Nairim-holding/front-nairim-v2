import prisma from '@/infra/database/prisma';
import { Prisma } from '@/generated/prisma/client';
import { getReportingCompanyIds } from '@/infra/database/reporting-context';
import { financialDateField } from '@/core/entities/financial-report';
import type { TransactionEntityFilters, MonthlySummaryMultiResult, ExpenseByCategoryResult, SubcategoryBreakdownResult } from '@/core/entities/financial-transaction';
import { reportingIdentity } from '@/shared/utils/reporting-identity';
import { parseLocalDate } from '@/shared/utils/date-utils';

function baseWhere(filters: TransactionEntityFilters, start?: Date, end?: Date) {
  const ids = getReportingCompanyIds();
  if (!ids?.length) throw new Error('Escopo de relatório não autorizado.');
  const date = Prisma.raw(`t."${financialDateField(filters.regime)}"`);
  const conditions = [Prisma.sql`t.company_id IN (${Prisma.join([...ids])})`, Prisma.sql`t.deleted_at IS NULL`, Prisma.sql`t.is_transfer = false`];
  if (start) conditions.push(Prisma.sql`${date} >= ${parseLocalDate(start)}`);
  if (end) conditions.push(Prisma.sql`${date} <= ${parseLocalDate(end)}`);
  for (const field of ['category_id', 'subcategory_id', 'financial_institution_id', 'card_id', 'center_id', 'supplier_id'] as const) {
    if (filters[field]?.length) conditions.push(Prisma.sql`${Prisma.raw(`t."${field}"`)} IN (${Prisma.join(filters[field]!)})`);
  }
  if (filters.description?.length) conditions.push(Prisma.sql`(${Prisma.join(filters.description.map(d => Prisma.sql`t.description ILIKE ${'%' + d + '%'}`), ' OR ')})`);
  return { date, where: Prisma.join(conditions, ' AND ') };
}

export async function consolidatedMonthlySummary(years: number[], filters: TransactionEntityFilters): Promise<MonthlySummaryMultiResult> {
  const { date, where } = baseWhere(filters, new Date(Date.UTC(years[0], 0, 1)), new Date(Date.UTC(years[years.length - 1], 11, 31)));
  const rows = await prisma.$queryRaw<{ year: number; month: number; type: string; amount: unknown }[]>(Prisma.sql`
    SELECT EXTRACT(YEAR FROM ${date})::int AS year, EXTRACT(MONTH FROM ${date})::int AS month,
      c.type::text AS type, SUM(t.amount) AS amount
    FROM "Transaction" t JOIN "Category" c ON c.id = t.category_id
    WHERE ${where} GROUP BY year, month, c.type`);
  const result = years.map(year => ({ year, months: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, income: 0, expense: 0 })) }));
  const byYear = new Map(result.map(r => [r.year, r.months]));
  for (const row of rows) {
    const month = byYear.get(row.year)?.[row.month - 1];
    if (!month) continue;
    if (row.type === 'INCOME') month.income += Number(row.amount);
    if (row.type === 'EXPENSE') month.expense += Number(row.amount);
  }
  return result;
}

export async function consolidatedAvailableYears() {
  const { where } = baseWhere({});
  const rows = await prisma.$queryRaw<{ year: number }[]>(Prisma.sql`
    SELECT DISTINCT EXTRACT(YEAR FROM d.date)::int AS year FROM "Transaction" t
    CROSS JOIN LATERAL (VALUES(t.event_date), (t.effective_date)) AS d(date)
    WHERE ${where} ORDER BY year DESC`);
  return { years: rows.map(r => r.year) };
}

export async function consolidatedExpenseCategories(start: Date, end: Date, filters: TransactionEntityFilters): Promise<ExpenseByCategoryResult> {
  const { date, where } = baseWhere(filters, start, end);
  const rows = await prisma.$queryRaw<{ id: string; name: string; type: string; year: number; amount: unknown }[]>(Prisma.sql`
    SELECT c.id, c.name, c.type::text AS type, EXTRACT(YEAR FROM ${date})::int AS year, SUM(t.amount) AS amount
    FROM "Transaction" t JOIN "Category" c ON c.id = t.category_id
    WHERE ${where} GROUP BY c.id, c.name, c.type, year`);
  let totalIncome = 0;
  const groups = new Map<string, { categoryId: string; name: string; value: number; years: Map<number, number> }>();
  for (const row of rows) {
    if (row.type === 'INCOME') { totalIncome += Number(row.amount); continue; }
    if (row.type !== 'EXPENSE') continue;
    const key = reportingIdentity(row.type, row.name);
    const group = groups.get(key) ?? { categoryId: row.id, name: row.name, value: 0, years: new Map() };
    group.value += Number(row.amount); group.years.set(row.year, (group.years.get(row.year) ?? 0) + Number(row.amount)); groups.set(key, group);
  }
  return { totalIncome, categories: [...groups.values()].map(({ years, ...g }) => ({ ...g,
    byYear: years.size > 1 ? [...years].sort(([a], [b]) => a - b).map(([year, value]) => ({ year, value })) : undefined })).sort((a, b) => b.value - a.value) };
}

export async function consolidatedSubcategories(categoryId: string, start: Date, end: Date, filters: TransactionEntityFilters): Promise<SubcategoryBreakdownResult> {
  const category = await prisma.category.findFirst({ where: { id: categoryId, deleted_at: null }, select: { id: true, name: true, type: true } });
  if (!category) throw new Error('Categoria não encontrada');
  const candidates = await prisma.category.findMany({ where: { deleted_at: null, type: category.type }, select: { id: true, name: true } });
  const equivalentIds = candidates.filter(c => reportingIdentity(c.name) === reportingIdentity(category.name)).map(c => c.id);
  const { date, where } = baseWhere({ ...filters, category_id: equivalentIds }, start, end);
  const rows = await prisma.$queryRaw<{ id: string | null; name: string | null; year: number; amount: unknown }[]>(Prisma.sql`
    SELECT s.id, s.name, EXTRACT(YEAR FROM ${date})::int AS year, SUM(t.amount) AS amount
    FROM "Transaction" t LEFT JOIN "Subcategory" s ON s.id = t.subcategory_id
    WHERE ${where} GROUP BY s.id, s.name, year`);
  const groups = new Map<string, { subcategoryId: string | null; name: string; value: number; years: Map<number, number> }>();
  for (const row of rows) {
    const key = row.id ? reportingIdentity(category.type, category.name, row.name) : 'none';
    const group = groups.get(key) ?? { subcategoryId: row.id, name: row.name ?? 'Sem subcategoria', value: 0, years: new Map() };
    group.value += Number(row.amount); group.years.set(row.year, (group.years.get(row.year) ?? 0) + Number(row.amount)); groups.set(key, group);
  }
  const subcategories = [...groups.values()].map(({ years, ...g }) => ({ ...g,
    byYear: years.size > 1 ? [...years].sort(([a], [b]) => a - b).map(([year, value]) => ({ year, value })) : undefined })).sort((a, b) => b.value - a.value);
  return { categoryId, categoryName: category.name, total: subcategories.reduce((sum, g) => sum + g.value, 0), subcategories };
}
