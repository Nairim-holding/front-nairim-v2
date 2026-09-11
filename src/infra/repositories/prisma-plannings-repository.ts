import prisma from '@/infra/database/prisma';
import type { PlanningsRepository } from '@/core/repositories/plannings-repository';
import type {
  MonthlyData,
  Planning,
  PlanningCategoryDashboard,
  PlanningDashboardFilters,
  PlanningDashboardItem,
  PlanningDashboardResponse,
  PlanningMonthlyValue,
  UpsertPlanningData,
} from '@/core/entities/planning';
import { parseLocalDate } from '@/shared/utils/date-utils';
import { NotFoundError } from '@/core/errors/domain-errors';

/**
 * Implementacao Prisma de {@link PlanningsRepository}.
 * Porte fiel de api-nairim-v2/src/services/PlanningService.ts (Planning +
 * PlanningMonth + dashboard).
 *
 * Tenant: `Planning`, `Category`, `Subcategory` e `Transaction` estao em
 * TENANT_MODELS — a extensao injeta `company_id` nas leituras e nos creates.
 *
 * FIDELIDADE do dashboard:
 *  - Meses gerados a partir das strings YYYY-MM-DD (sem timezone/overflow).
 *  - Categorias ativas com subcategorias ativas, ordenadas por type/name.
 *  - Planejamentos globais (sem filtro de ano) indexados por `category::sub`.
 *  - Transacoes COMPLETED no periodo + filtros do botao Filtro; `status` de
 *    fora ("realizado" e COMPLETED por definicao).
 *  - Saldo anterior (antes de startDate) acumulado nas linhas dos meses.
 *  - FIXED: planejado = default_amount (NAO multiplica por meses). VARIABLE:
 *    planejado = valor do mes corrente. Com `sumPlannedOverPeriod` (so os
 *    graficos do dashboard passam), o planejado soma um valor por mes do
 *    periodo — ver sumPlannedOverMonths.
 *  - monthly_values no item: sempre 12 meses (VARIABLE usa os gravados, FIXED
 *    usa default_amount em todos).
 *
 * Camada: infra.
 */

const DASHBOARD_FILTER_FIELDS = [
  'category_id',
  'subcategory_id',
  'financial_institution_id',
  'card_id',
  'center_id',
  'supplier_id',
  'description',
] as const;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Planejado de um planejamento.
 *
 * `overPeriod = true` (gráficos do dashboard): soma um valor por mês do
 * recorte — espelha o realizado, que soma os lançamentos de todos os meses.
 *  - FIXED: `default_amount` em cada mês (12 meses => 12x o valor mensal).
 *  - VARIABLE: o valor gravado de cada mês-calendário; mês sem registro = 0.
 *    `monthly_values` não tem ano, então Jan/25 e Jan/26 usam ambos Janeiro.
 *
 * `overPeriod = false` (padrão, tela de Planejamento): valor de um único mês,
 * comportamento original — FIXED usa `default_amount` e VARIABLE o mês
 * corrente do relógio.
 */
function sumPlannedOverMonths(
  planning: { type: string; default_amount: unknown; monthly_values: Array<{ month: number; amount: unknown }> } | undefined,
  months: Array<{ month: number; year: number }>,
  overPeriod: boolean,
): number {
  if (!planning) return 0;

  if (!overPeriod) {
    if (planning.type === 'FIXED') return Number(planning.default_amount ?? 0);
    if (planning.type === 'VARIABLE') {
      const currentMonth = new Date().getMonth() + 1;
      const mv = planning.monthly_values.find((m) => m.month === currentMonth);
      return Number(mv?.amount ?? 0);
    }
    return 0;
  }

  if (planning.type === 'FIXED') {
    return Number(planning.default_amount ?? 0) * months.length;
  }

  if (planning.type === 'VARIABLE') {
    let total = 0;
    for (const { month } of months) {
      const mv = planning.monthly_values.find((m) => m.month === month);
      total += Number(mv?.amount ?? 0);
    }
    return total;
  }

  return 0;
}

export class PrismaPlanningsRepository implements PlanningsRepository {
  async upsert(data: UpsertPlanningData & { company_id?: string }): Promise<Planning> {
    const sentMonths = new Map<number, number>(
      (data.monthly_values ?? []).map((mv) => [Number(mv.month), Number(mv.amount)]),
    );
    // FIXED usa default_amount diretamente — sem registros mensais. VARIABLE
    // armazena sempre os 12 meses (zeros inclusos).
    const monthlyValuesData: Array<{ month: number; amount: number }> =
      data.type === 'FIXED'
        ? []
        : Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            amount: sentMonths.get(i + 1) ?? 0,
          }));

    const { min, max } = await this.calculateMinMaxFromTransactionHistory(data.category_id, data.subcategory_id);

    const planningData = {
      category_id: data.category_id,
      subcategory_id: data.subcategory_id ?? null,
      type: data.type,
      default_amount: data.default_amount != null ? data.default_amount : null,
      min_recommended: min,
      max_recommended: max,
      is_active: true,
    };

    const existing = await prisma.planning.findFirst({
      where: {
        category_id: data.category_id,
        subcategory_id: data.subcategory_id ?? null,
        deleted_at: null,
      },
      select: { id: true },
    });

    const planningId = existing?.id ?? (
      await prisma.planning.create({
        data: {
          ...planningData,
          ...(data.company_id ? { company_id: data.company_id } : {}),
        } as never,
      })
    ).id;

    if (existing) {
      await prisma.planning.update({ where: { id: planningId }, data: planningData });
    }

    await prisma.planningMonth.deleteMany({ where: { planning_id: planningId } });
    if (monthlyValuesData.length > 0) {
      await prisma.planningMonth.createMany({
        data: monthlyValuesData.map((mv) => ({ planning_id: planningId, ...mv })),
      });
    }

    const full = await prisma.planning.findUnique({
      where: { id: planningId },
      include: { monthly_values: { orderBy: { month: 'asc' } } },
    });
    if (!full) throw new NotFoundError('Planning not found');
    return this.toPlanning(full);
  }

  async remove(id: string): Promise<Planning> {
    const existing = await prisma.planning.findUnique({ where: { id, deleted_at: null } });
    if (!existing) throw new NotFoundError('Planning not found');
    const updated = await prisma.planning.update({ where: { id }, data: { deleted_at: new Date() } });
    return this.toPlanning(updated);
  }

  async getDashboard(
    startDate: string,
    endDate: string,
    filters?: PlanningDashboardFilters,
    sumPlannedOverPeriod = false,
  ): Promise<PlanningDashboardResponse> {
    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);
    end.setUTCHours(23, 59, 59, 999);

    // Gera lista de meses no período a partir das strings (evita timezone e
    // overflow de dia em setMonth, ex: dia 31).
    const months: Array<{ month: number; year: number }> = [];
    const [startYear, startMonth] = startDate.split('-').map(Number);
    const [endYear, endMonth] = endDate.split('-').map(Number);
    let cursorYear = startYear;
    let cursorMonth = startMonth;
    while (cursorYear < endYear || (cursorYear === endYear && cursorMonth <= endMonth)) {
      months.push({ month: cursorMonth, year: cursorYear });
      cursorMonth++;
      if (cursorMonth > 12) {
        cursorMonth = 1;
        cursorYear++;
      }
    }

    const categories = await prisma.category.findMany({
      where: { deleted_at: null, is_active: true },
      include: {
        subcategories: { where: { deleted_at: null, is_active: true }, orderBy: { name: 'asc' } },
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });

    // Planejamentos ativos (globais, sem filtro de ano), com valores mensais.
    const plannings = await prisma.planning.findMany({
      where: { deleted_at: null },
      include: { monthly_values: { orderBy: { month: 'asc' } } },
    });

    const planningMap = new Map<string, (typeof plannings)[number]>();
    for (const p of plannings) {
      planningMap.set(`${p.category_id}::${p.subcategory_id ?? ''}`, p);
    }

    // Filtros do botão Filtro aplicados às transações agregadas.
    const extraWhere: Record<string, { in: string[] }> = {};
    for (const field of DASHBOARD_FILTER_FIELDS) {
      const values = filters?.[field];
      if (values?.length) extraWhere[field] = { in: values };
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        deleted_at: null,
        status: 'COMPLETED',
        effective_date: { gte: start, lte: end },
        ...extraWhere,
      },
      select: {
        category_id: true,
        subcategory_id: true,
        amount: true,
        effective_date: true,
        category: { select: { type: true } },
      },
    });

    // Agrupa: categoryId -> (subcategoryId|'TOTAL') -> monthKey -> amount
    const txByCategory = new Map<string, Map<string, Map<string, number>>>();
    for (const tx of transactions) {
      const catId = tx.category_id;
      const subId = tx.subcategory_id ?? '';
      const mk = monthKey(tx.effective_date);
      const amount = Number(tx.amount);

      if (!txByCategory.has(catId)) txByCategory.set(catId, new Map());
      const subMap = txByCategory.get(catId)!;

      if (!subMap.has(subId)) subMap.set(subId, new Map());
      const subTxMap = subMap.get(subId)!;
      subTxMap.set(mk, (subTxMap.get(mk) ?? 0) + amount);

      if (!subMap.has('TOTAL')) subMap.set('TOTAL', new Map());
      const catTxMap = subMap.get('TOTAL')!;
      catTxMap.set(mk, (catTxMap.get(mk) ?? 0) + amount);
    }

    const previousBalance = await this.calculatePreviousBalance(start);

    const monthKeys = months.map((m) => `${m.year}-${String(m.month).padStart(2, '0')}`);

    // Saldos mensais e acumulados
    const monthlyBalances: MonthlyData[] = [];
    const accumulatedBalances: MonthlyData[] = [];
    let accumulated = previousBalance;

    for (const { month, year } of months) {
      const mk = `${year}-${String(month).padStart(2, '0')}`;
      let monthIncome = 0;
      let monthExpense = 0;

      for (const [catId, subMap] of txByCategory) {
        const category = categories.find((c) => c.id === catId);
        const catTotal = subMap.get('TOTAL')?.get(mk) ?? 0;
        if (category?.type === 'INCOME') monthIncome += catTotal;
        else monthExpense += catTotal;
      }

      const monthBalance = monthIncome - monthExpense;
      accumulated += monthBalance;

      monthlyBalances.push({ month, year, realized_amount: round2(monthBalance) });
      accumulatedBalances.push({ month, year, realized_amount: round2(accumulated) });
    }

    const buildItem = (
      id: string,
      name: string,
      txMap: Map<string, number> | undefined,
      planningData: (typeof plannings)[number] | undefined,
    ): PlanningDashboardItem => {
      const monthlyRealized = monthKeys.map((mk) => ({
        month: parseInt(mk.split('-')[1], 10),
        year: parseInt(mk.split('-')[0], 10),
        realized_amount: round2(txMap?.get(mk) ?? 0),
      }));

      const realizedTotal = monthlyRealized.reduce((s, m) => s + m.realized_amount, 0);

      // Com a flag (gráficos do dashboard), o planejado acompanha o MESMO
      // recorte do realizado: soma um valor por mês do período — senão um
      // filtro de 12 meses compara 12 meses de realizado contra 1 de planejado.
      // Sem a flag, mantém o valor de um único mês (tela de Planejamento).
      const plannedTotal = sumPlannedOverMonths(planningData, months, sumPlannedOverPeriod);

      const percentage =
        plannedTotal > 0 ? Math.round((realizedTotal / plannedTotal) * 10000) / 100 : 0;

      // Min/méd/máx baseados nos VALORES REALIZADOS do período.
      const nonZeroMonths = monthlyRealized.filter((m) => m.realized_amount > 0);
      const average =
        nonZeroMonths.length > 0
          ? round2(nonZeroMonths.reduce((s, m) => s + m.realized_amount, 0) / nonZeroMonths.length)
          : 0;
      const minValue = nonZeroMonths.length > 0 ? Math.min(...nonZeroMonths.map((m) => m.realized_amount)) : null;
      const maxValue = nonZeroMonths.length > 0 ? Math.max(...nonZeroMonths.map((m) => m.realized_amount)) : null;

      // monthly_values do item: sempre os 12 meses (VARIABLE = gravados, FIXED = default).
      const monthlyValues: Array<{ month: number; amount: number }> = [];
      for (let m = 1; m <= 12; m++) {
        let amount = 0;
        if (planningData?.type === 'VARIABLE') {
          const mv = planningData.monthly_values.find((v) => v.month === m);
          amount = Number(mv?.amount ?? 0);
        } else if (planningData?.type === 'FIXED') {
          amount = Number(planningData.default_amount ?? 0);
        }
        monthlyValues.push({ month: m, amount: round2(amount) });
      }

      return {
        id,
        name,
        planning_type: planningData?.type ?? undefined,
        planned_amount: round2(plannedTotal),
        realized_amount: round2(realizedTotal),
        percentage,
        min: minValue,
        med: average,
        max: maxValue,
        min_recommended: null,
        max_recommended: null,
        monthly_data: monthlyRealized,
        monthly_values: monthlyValues,
      };
    };

    const incomes: PlanningCategoryDashboard[] = [];
    const expenses: PlanningCategoryDashboard[] = [];

    for (const cat of categories) {
      const catSubMap = txByCategory.get(cat.id);
      const catTxMap = catSubMap?.get('TOTAL');
      const catPlanningKey = `${cat.id}::`;
      const catPlanning = planningMap.get(catPlanningKey);

      const subcategoryItems: PlanningDashboardItem[] = cat.subcategories.map((sub) => {
        const subTxMap = catSubMap?.get(sub.id);
        const subPlanning = planningMap.get(`${cat.id}::${sub.id}`);
        return buildItem(sub.id, sub.name, subTxMap, subPlanning);
      });

      let catPlannedTotal = 0;
      for (const subItem of subcategoryItems) catPlannedTotal += subItem.planned_amount;

      const catMonthlyData: MonthlyData[] = months.map(({ month, year }) => {
        const mk = `${year}-${String(month).padStart(2, '0')}`;
        return { month, year, realized_amount: round2(catTxMap?.get(mk) ?? 0) };
      });

      // Mesma regra do item (ver buildItem).
      catPlannedTotal += sumPlannedOverMonths(catPlanning, months, sumPlannedOverPeriod);

      const catRealizedTotal = catMonthlyData.reduce((s, m) => s + m.realized_amount, 0);
      const catPercentage =
        catPlannedTotal > 0 ? Math.round((catRealizedTotal / catPlannedTotal) * 10000) / 100 : 0;

      const nonZeroMonths = catMonthlyData.filter((m) => m.realized_amount > 0);
      const catAverage =
        nonZeroMonths.length > 0
          ? round2(nonZeroMonths.reduce((s, m) => s + m.realized_amount, 0) / nonZeroMonths.length)
          : 0;
      const catMinValue = nonZeroMonths.length > 0 ? Math.min(...nonZeroMonths.map((m) => m.realized_amount)) : null;
      const catMaxValue = nonZeroMonths.length > 0 ? Math.max(...nonZeroMonths.map((m) => m.realized_amount)) : null;

      // monthly_values da categoria: soma das subcategorias + planejamento direto.
      const catMonthlyValues: Array<{ month: number; amount: number }> = Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        let amount = 0;
        for (const subItem of subcategoryItems) {
          const subMonthValue = subItem.monthly_values.find((mv) => mv.month === month);
          if (subMonthValue) amount += subMonthValue.amount;
        }
        if (catPlanning) {
          if (catPlanning.type === 'FIXED') {
            amount += Number(catPlanning.default_amount ?? 0);
          } else if (catPlanning.type === 'VARIABLE') {
            const mv = catPlanning.monthly_values.find((m) => m.month === month);
            amount += Number(mv?.amount ?? 0);
          }
        }
        return { month, amount: round2(amount) };
      });

      const categoryDashboard: PlanningCategoryDashboard = {
        id: cat.id,
        name: cat.name,
        type: cat.type,
        planning_type: catPlanning?.type ?? undefined,
        planned_amount: round2(catPlannedTotal),
        realized_amount: round2(catRealizedTotal),
        percentage: catPercentage,
        min: catMinValue,
        med: round2(catAverage),
        max: catMaxValue,
        min_recommended: null,
        max_recommended: null,
        monthly_data: catMonthlyData,
        monthly_values: catMonthlyValues,
        subcategories: subcategoryItems,
      };

      if (cat.type === 'INCOME') incomes.push(categoryDashboard);
      else expenses.push(categoryDashboard);
    }

    // Totais globais (Total de Receitas / Total de Despesas)
    const incomeGlobal = this.buildGlobalCategory(incomes, 'INCOME', 'Total de Receitas', months, 'incomes-global');
    const expenseGlobal = this.buildGlobalCategory(expenses, 'EXPENSE', 'Total de Despesas', months, 'expenses-global');

    return {
      start_date: startDate,
      end_date: endDate,
      balances: { monthly: monthlyBalances, accumulated: accumulatedBalances },
      incomes: [incomeGlobal, ...incomes],
      expenses: [expenseGlobal, ...expenses],
    };
  }

  private buildGlobalCategory(
    categories: PlanningCategoryDashboard[],
    type: 'INCOME' | 'EXPENSE',
    name: string,
    months: Array<{ month: number; year: number }>,
    id: string,
  ): PlanningCategoryDashboard {
    const totalPlanned = categories.reduce((s, cat) => s + cat.planned_amount, 0);
    const totalRealized = categories.reduce((s, cat) => s + cat.realized_amount, 0);
    const totalMin = categories.reduce((s, cat) => s + (cat.min ?? 0), 0);
    const totalMax = categories.reduce((s, cat) => s + (cat.max ?? 0), 0);
    const totalMed = categories.reduce((s, cat) => s + cat.med, 0);
    const totalPercentage = totalPlanned > 0 ? Math.round((totalRealized / totalPlanned) * 10000) / 100 : 0;

    const globalMonthly: MonthlyData[] = months.map(({ month, year }) => {
      let amount = 0;
      for (const cat of categories) {
        const monthData = cat.monthly_data.find((m) => m.month === month && m.year === year);
        if (monthData) amount += monthData.realized_amount;
      }
      return { month, year, realized_amount: round2(amount) };
    });

    const globalMonthlyValues: Array<{ month: number; amount: number }> = months.map(({ month }) => {
      let amount = 0;
      for (const cat of categories) {
        const monthValue = cat.monthly_values.find((mv) => mv.month === month);
        if (monthValue) amount += monthValue.amount;
      }
      return { month, amount: round2(amount) };
    });

    return {
      id,
      name,
      type,
      planned_amount: round2(totalPlanned),
      realized_amount: round2(totalRealized),
      percentage: totalPercentage,
      min: round2(totalMin),
      med: round2(totalMed),
      max: round2(totalMax),
      min_recommended: null,
      max_recommended: null,
      monthly_data: globalMonthly,
      monthly_values: globalMonthlyValues,
      subcategories: [],
      planning_type: undefined,
    };
  }

  private async calculateMinMaxFromTransactionHistory(
    categoryId: string,
    subcategoryId: string | null | undefined,
  ): Promise<{ min: number | null; max: number | null }> {
    const transactions = await prisma.transaction.findMany({
      where: {
        category_id: categoryId,
        subcategory_id: subcategoryId ?? undefined,
        deleted_at: null,
      },
      select: { amount: true, effective_date: true },
    });

    if (transactions.length === 0) return { min: null, max: null };

    const monthlyTotals = new Map<string, number>();
    for (const tx of transactions) {
      const amount = Number(tx.amount);
      monthlyTotals.set(monthKey(tx.effective_date), (monthlyTotals.get(monthKey(tx.effective_date)) ?? 0) + amount);
    }

    const totals = Array.from(monthlyTotals.values());
    return { min: round2(Math.min(...totals)), max: round2(Math.max(...totals)) };
  }

  private async calculatePreviousBalance(beforeDate: Date): Promise<number> {
    const transactions = await prisma.transaction.findMany({
      where: {
        deleted_at: null,
        status: 'COMPLETED',
        effective_date: { lt: beforeDate },
      },
      select: { amount: true, category: { select: { type: true } } },
    });

    let balance = 0;
    for (const tx of transactions) {
      const amount = Number(tx.amount);
      if (tx.category.type === 'INCOME') balance += amount;
      else balance -= amount;
    }
    return balance;
  }

  private toPlanning(row: any): Planning {
    const monthlyValues: PlanningMonthlyValue[] = (row.monthly_values ?? []).map(
      (mv: { month: number; amount: unknown }) => ({ month: mv.month, amount: Number(mv.amount) }),
    );
    return {
      ...row,
      default_amount: row.default_amount != null ? Number(row.default_amount) : null,
      min_recommended: row.min_recommended != null ? Number(row.min_recommended) : null,
      max_recommended: row.max_recommended != null ? Number(row.max_recommended) : null,
      monthly_values: monthlyValues,
    };
  }
}