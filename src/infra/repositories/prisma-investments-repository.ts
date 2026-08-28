import prisma from '@/infra/database/prisma';
import { getCurrentCompanyId } from '@/infra/database/tenant-context';
import type { InvestmentsRepository } from '@/core/repositories/investments-repository';
import type {
  CreateInvestmentData,
  Investment,
  InvestmentDashboardParams,
  InvestmentDashboardResponse,
  InvestmentMonthCell,
  InvestmentProductType,
  InvestmentRow,
  InvestmentSettings,
  InvestmentSummaryRow,
  InvestmentTransactionEntry,
  UpdateInvestmentData,
  UpsertInvestmentTransactionData,
} from '@/core/entities/investment';
import { NotFoundError } from '@/core/errors/domain-errors';
import {
  buildSummary,
  expandMonths,
  monthKey,
  resolveBalanceSeries,
  round2,
} from '@/core/use-cases/investment/dashboard-math';
import { formatLocalDate, parseLocalDate } from '@/shared/utils/date-utils';
import { INVESTMENT_PRODUCT_TYPE_LABELS } from '@/shared/utils/investment-product-types';

/**
 * Implementação Prisma de {@link InvestmentsRepository}.
 *
 * ISOLAMENTO: só `Investment`/`InvestmentSettings` estão em TENANT_MODELS. As
 * filhas (transações, saldos mensais) são alcançadas apenas depois de resolver
 * o investimento pai por `prisma.investment.findFirst` — que já vem com
 * `company_id` injetado —, então nenhuma query filha escapa do tenant.
 *
 * Camada: infra.
 */


type InvestmentRecord = {
  id: string;
  company_id: string;
  financial_institution_id: string;
  partition: string;
  issuer: string;
  product_type: InvestmentProductType;
  product: string;
  application_date: Date;
  maturity_date: Date | null;
  liquidity_days: number | null;
  liquidity_at_maturity: boolean;
  invested_amount: unknown;
  notes: string | null;
  display_order: number;
  liquidated_at: Date | null;
  is_active: boolean;
  financial_institution?: { name: string } | null;
};

function toEntity(row: InvestmentRecord): Investment {
  return {
    id: row.id,
    company_id: row.company_id,
    financial_institution_id: row.financial_institution_id,
    partition: row.partition,
    issuer: row.issuer,
    product_type: row.product_type,
    product: row.product,
    application_date: formatLocalDate(row.application_date),
    maturity_date: row.maturity_date ? formatLocalDate(row.maturity_date) : null,
    liquidity_days: row.liquidity_days,
    liquidity_at_maturity: row.liquidity_at_maturity,
    invested_amount: Number(row.invested_amount),
    notes: row.notes,
    display_order: row.display_order,
    liquidated_at: row.liquidated_at ? formatLocalDate(row.liquidated_at) : null,
    is_active: row.is_active,
    financial_institution_name: row.financial_institution?.name,
  };
}

function institutionLabel(row: Investment): string {
  const name = row.financial_institution_name ?? '';
  return row.partition ? `${name} - ${row.partition}` : name;
}

/**
 * Converte os filtros da tela (chave → lista de valores, mesma convenção do
 * botão Filtro de Lançamentos) no `where` do Prisma.
 */
function buildDashboardWhere(filters: Record<string, string[]> | undefined): Record<string, unknown> {
  const where: Record<string, unknown> = { deleted_at: null };
  if (!filters) return where;

  for (const [field, rawValues] of Object.entries(filters)) {
    const values = rawValues.filter((v) => v !== undefined && v !== null && v !== '');
    if (values.length === 0) continue;

    switch (field) {
      case 'financial_institution_id':
        where.financial_institution_id = { in: values };
        break;
      case 'partition':
        where.partition = { in: values };
        break;
      case 'product_type':
        where.product_type = { in: values };
        break;
      case 'issuer':
        where.issuer = { in: values };
        break;
      case 'product':
        where.product = { in: values };
        break;
      case 'is_liquidated':
        // Único filtro booleano da tela: "Investimento liquidado".
        where.liquidated_at = values[0] === 'true' ? { not: null } : null;
        break;
      case 'maturity_date': {
        // O DynamicFilterModal manda intervalo como JSON {from,to}.
        const range = parseDateRange(values[0]);
        if (range) where.maturity_date = range;
        break;
      }
      case 'application_date': {
        const range = parseDateRange(values[0]);
        if (range) where.application_date = range;
        break;
      }
      default:
        break;
    }
  }
  return where;
}

function parseDateRange(raw: string): { gte?: Date; lte?: Date } | null {
  try {
    const parsed = JSON.parse(raw) as { from?: string; to?: string };
    const range: { gte?: Date; lte?: Date } = {};
    if (parsed.from) range.gte = parseLocalDate(parsed.from);
    if (parsed.to) range.lte = parseLocalDate(parsed.to);
    return range.gte || range.lte ? range : null;
  } catch {
    return null;
  }
}

/** Investimento da empresa da sessão, ou erro — porta de entrada das filhas. */
async function requireInvestment(id: string): Promise<{ id: string; application_date: Date }> {
  const found = await prisma.investment.findFirst({
    where: { id, deleted_at: null },
    select: { id: true, application_date: true },
  });
  if (!found) throw new NotFoundError('Investimento não encontrado');
  return found;
}

/**
 * Soma do planejado de DESPESA do mês corrente — a pill "Gastos planejados do
 * mês atual". Mesma conta do dashboard de Planejamento: FIXED usa
 * `default_amount`; VARIABLE, o valor do mês.
 *
 * Somar TODAS as linhas (categoria e subcategoria) é o que o próprio dashboard
 * faz — lá o total da categoria é a soma das subcategorias MAIS o
 * planejamento da categoria, quando existe. Não é dupla contagem.
 */
async function getPlannedExpensesCurrentMonth(): Promise<number> {
  const currentMonth = new Date().getMonth() + 1;
  const plannings = await prisma.planning.findMany({
    where: { deleted_at: null, is_active: true, category: { type: 'EXPENSE' } },
    select: {
      type: true,
      default_amount: true,
      monthly_values: { where: { month: currentMonth }, select: { amount: true } },
    },
  });

  const total = plannings.reduce((sum, planning) => {
    if (planning.type === 'FIXED') return sum + Number(planning.default_amount ?? 0);
    return sum + Number(planning.monthly_values[0]?.amount ?? 0);
  }, 0);

  return round2(total);
}

export class PrismaInvestmentsRepository implements InvestmentsRepository {
  async getDashboard(params: InvestmentDashboardParams): Promise<InvestmentDashboardResponse> {
    const months = expandMonths(params.startMonth, params.endMonth);
    const where = buildDashboardWhere(params.filters);

    const records = await prisma.investment.findMany({
      where,
      include: { financial_institution: { select: { name: true } } },
      orderBy: [{ display_order: 'asc' }, { created_at: 'asc' }],
    });

    const investmentIds = records.map((r) => r.id);

    // Fim da janela: tudo até o último mês exibido entra no cálculo. O início
    // NÃO é cortado — o saldo herdado do primeiro mês depende do histórico
    // inteiro anterior, então lemos desde sempre e só recortamos na saída.
    const last = months[months.length - 1];
    const windowEnd = new Date(Date.UTC(last.year, last.month, 0)); // último dia do mês

    const [transactions, balances, plannedExpenses, settings] = await Promise.all([
      investmentIds.length
        ? prisma.investmentTransaction.findMany({
            where: { investment_id: { in: investmentIds }, date: { lte: windowEnd } },
            select: { investment_id: true, type: true, date: true, amount: true },
          })
        : Promise.resolve([]),
      investmentIds.length
        ? prisma.investmentMonthBalance.findMany({
            where: { investment_id: { in: investmentIds } },
            select: { investment_id: true, year: true, month: true, balance: true },
          })
        : Promise.resolve([]),
      getPlannedExpensesCurrentMonth(),
      this.getSettings(),
    ]);

    // aplicado[investimento][YYYY-MM] — aporte soma, resgate subtrai.
    const appliedBy = new Map<string, Map<string, number>>();
    for (const tx of transactions) {
      const date = tx.date;
      const key = monthKey(date.getUTCFullYear(), date.getUTCMonth() + 1);
      const perInvestment = appliedBy.get(tx.investment_id) ?? new Map<string, number>();
      const signed = tx.type === 'REDEMPTION' ? -Number(tx.amount) : Number(tx.amount);
      perInvestment.set(key, (perInvestment.get(key) ?? 0) + signed);
      appliedBy.set(tx.investment_id, perInvestment);
    }

    const manualBalanceBy = new Map<string, Map<string, number>>();
    for (const balance of balances) {
      const key = monthKey(balance.year, balance.month);
      const perInvestment = manualBalanceBy.get(balance.investment_id) ?? new Map<string, number>();
      perInvestment.set(key, Number(balance.balance));
      manualBalanceBy.set(balance.investment_id, perInvestment);
    }

    // O primeiro mês da grid precisa do saldo do mês ANTERIOR para o
    // Rendimento. Por isso a série é calculada de (aplicação − 1 mês) até o
    // fim da janela e só depois recortada nos meses exibidos.
    const investments: InvestmentRow[] = [];
    const balanceSeries = new Map<string, Map<string, number | null>>();
    const appliedSeries = new Map<string, Map<string, number>>();

    for (const record of records) {
      const entity = toEntity(record as InvestmentRecord);
      const applied = appliedBy.get(entity.id) ?? new Map<string, number>();
      const manual = manualBalanceBy.get(entity.id) ?? new Map<string, number>();

      const appDate = record.application_date;
      const seriesStart = { year: appDate.getUTCFullYear(), month: appDate.getUTCMonth() + 1 };
      // Cobre o caso de saldo informado em mês anterior à aplicação (importação).
      const earliestManual = [...manual.keys()].sort()[0];
      if (earliestManual) {
        const [my, mm] = earliestManual.split('-').map(Number);
        if (my < seriesStart.year || (my === seriesStart.year && mm < seriesStart.month)) {
          seriesStart.year = my;
          seriesStart.month = mm;
        }
      }

      const seriesStartKey = monthKey(seriesStart.year, seriesStart.month);
      const seriesMonths =
        seriesStartKey <= monthKey(last.year, last.month)
          ? expandMonths(seriesStartKey, monthKey(last.year, last.month))
          : [];

      const resolved = resolveBalanceSeries(seriesMonths, applied, manual);
      balanceSeries.set(entity.id, resolved);
      appliedSeries.set(entity.id, applied);

      const cells: InvestmentMonthCell[] = months.map(({ year, month }) => {
        const key = monthKey(year, month);
        return {
          year,
          month,
          applied: round2(applied.get(key) ?? 0),
          balance: resolved.has(key) ? resolved.get(key)! : null,
          balance_is_manual: manual.has(key),
        };
      });

      investments.push({ ...entity, institution_label: institutionLabel(entity), months: cells });
    }

    const reference = settings.independence_reference_amount;
    // Sem valor de referência configurado, a tela usa os gastos planejados do
    // mês — é a referência que o próprio layout sugere ao lado do indicador.
    const independenceBase = reference && reference > 0 ? reference : plannedExpenses;

    const summary: InvestmentSummaryRow[] = buildSummary(
      months,
      investments.map((investment) => ({
        balances: balanceSeries.get(investment.id) ?? new Map<string, number | null>(),
        applied: appliedSeries.get(investment.id) ?? new Map<string, number>(),
      })),
      independenceBase,
    );

    return {
      start_month: params.startMonth,
      end_month: params.endMonth,
      months,
      investments,
      summary,
      planned_expenses_current_month: plannedExpenses,
      independence_reference_amount: reference,
      independence_base: independenceBase,
    };
  }

  async list(): Promise<Investment[]> {
    const records = await prisma.investment.findMany({
      where: { deleted_at: null },
      include: { financial_institution: { select: { name: true } } },
      orderBy: [{ display_order: 'asc' }, { created_at: 'asc' }],
    });
    return records.map((record) => toEntity(record as InvestmentRecord));
  }

  async findById(id: string): Promise<Investment | null> {
    const record = await prisma.investment.findFirst({
      where: { id, deleted_at: null },
      include: { financial_institution: { select: { name: true } } },
    });
    return record ? toEntity(record as InvestmentRecord) : null;
  }

  async create(data: CreateInvestmentData): Promise<Investment> {
    // Novo investimento vai para o fim da ordem de exibição.
    const lastOrder = await prisma.investment.aggregate({
      where: { deleted_at: null },
      _max: { display_order: true },
    });

    // `company_id` vai EXPLÍCITO aqui, diferente dos outros repositórios que
    // deixam a extensão multi-tenant injetar: este create tem escrita aninhada
    // (`transactions.create`), e nesse formato o Prisma passa a exigir o
    // relacionamento `company` em vez do escalar — a injeção da extensão não
    // resolve e o create falha com "Argument `company` is missing".
    const companyId = getCurrentCompanyId();
    if (!companyId) throw new NotFoundError('Contexto de empresa não identificado');

    const created = await prisma.investment.create({
      data: {
        company_id: companyId,
        financial_institution_id: data.financial_institution_id,
        partition: data.partition?.trim() || 'Principal',
        issuer: data.issuer.trim(),
        product_type: data.product_type,
        product: data.product.trim(),
        application_date: parseLocalDate(data.application_date),
        maturity_date: data.maturity_date ? parseLocalDate(data.maturity_date) : null,
        liquidity_days: data.liquidity_at_maturity ? null : (data.liquidity_days ?? null),
        liquidity_at_maturity: data.liquidity_at_maturity ?? false,
        invested_amount: data.invested_amount,
        notes: data.notes?.trim() || null,
        display_order: (lastOrder._max.display_order ?? 0) + 1,
        // A aplicação inicial é a primeira transação: é ela que aparece na
        // linha "Aplicado" do mês da aplicação, junto de eventuais aportes.
        transactions: {
          create: {
            type: 'CONTRIBUTION',
            date: parseLocalDate(data.application_date),
            amount: data.invested_amount,
          },
        },
      },
      include: { financial_institution: { select: { name: true } } },
    });

    return toEntity(created as InvestmentRecord);
  }

  async update(id: string, data: UpdateInvestmentData): Promise<Investment> {
    await requireInvestment(id);

    const payload: Record<string, unknown> = {};
    if (data.financial_institution_id !== undefined) payload.financial_institution_id = data.financial_institution_id;
    if (data.partition !== undefined) payload.partition = data.partition?.trim() || 'Principal';
    if (data.issuer !== undefined) payload.issuer = data.issuer.trim();
    if (data.product_type !== undefined) payload.product_type = data.product_type;
    if (data.product !== undefined) payload.product = data.product.trim();
    if (data.application_date !== undefined) payload.application_date = parseLocalDate(data.application_date);
    if (data.maturity_date !== undefined) {
      payload.maturity_date = data.maturity_date ? parseLocalDate(data.maturity_date) : null;
    }
    if (data.liquidity_at_maturity !== undefined) payload.liquidity_at_maturity = data.liquidity_at_maturity;
    if (data.liquidity_days !== undefined) payload.liquidity_days = data.liquidity_days;
    if (data.liquidity_at_maturity === true) payload.liquidity_days = null;
    if (data.invested_amount !== undefined) payload.invested_amount = data.invested_amount;
    if (data.notes !== undefined) payload.notes = data.notes?.trim() || null;
    if (data.liquidated_at !== undefined) {
      payload.liquidated_at = data.liquidated_at ? parseLocalDate(data.liquidated_at) : null;
    }

    const updated = await prisma.investment.update({
      where: { id },
      data: payload,
      include: { financial_institution: { select: { name: true } } },
    });

    // A transação da aplicação inicial acompanha data/valor do investimento —
    // senão a linha "Aplicado" contradiria o cadastro logo após uma edição.
    if (data.application_date !== undefined || data.invested_amount !== undefined) {
      const first = await prisma.investmentTransaction.findFirst({
        where: { investment_id: id },
        orderBy: [{ date: 'asc' }, { created_at: 'asc' }],
        select: { id: true },
      });
      if (first) {
        await prisma.investmentTransaction.update({
          where: { id: first.id },
          data: {
            ...(data.application_date !== undefined ? { date: parseLocalDate(data.application_date) } : {}),
            ...(data.invested_amount !== undefined ? { amount: data.invested_amount } : {}),
          },
        });
      }
    }

    return toEntity(updated as InvestmentRecord);
  }

  async softDelete(id: string): Promise<void> {
    await requireInvestment(id);
    await prisma.investment.update({ where: { id }, data: { deleted_at: new Date(), is_active: false } });
  }

  async reorder(orderedIds: string[]): Promise<void> {
    const owned = await prisma.investment.findMany({
      where: { id: { in: orderedIds }, deleted_at: null },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((o) => o.id));

    await prisma.$transaction(
      orderedIds
        .filter((id) => ownedIds.has(id))
        .map((id, index) => prisma.investment.update({ where: { id }, data: { display_order: index + 1 } })),
    );
  }

  async updateNotes(id: string, notes: string | null): Promise<Investment> {
    await requireInvestment(id);
    const updated = await prisma.investment.update({
      where: { id },
      data: { notes },
      include: { financial_institution: { select: { name: true } } },
    });
    return toEntity(updated as InvestmentRecord);
  }

  async listTransactions(investmentId: string, year: number, month: number): Promise<InvestmentTransactionEntry[]> {
    await requireInvestment(investmentId);
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0));

    const rows = await prisma.investmentTransaction.findMany({
      where: { investment_id: investmentId, date: { gte: start, lte: end } },
      orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
    });

    return rows.map((row) => ({
      id: row.id,
      investment_id: row.investment_id,
      type: row.type,
      date: formatLocalDate(row.date),
      amount: Number(row.amount),
    }));
  }

  async createTransaction(data: UpsertInvestmentTransactionData): Promise<InvestmentTransactionEntry> {
    await requireInvestment(data.investment_id);
    const created = await prisma.investmentTransaction.create({
      data: {
        investment_id: data.investment_id,
        type: data.type ?? 'CONTRIBUTION',
        date: parseLocalDate(data.date),
        amount: data.amount,
      },
    });
    return {
      id: created.id,
      investment_id: created.investment_id,
      type: created.type,
      date: formatLocalDate(created.date),
      amount: Number(created.amount),
    };
  }

  async updateTransaction(
    id: string,
    data: Omit<UpsertInvestmentTransactionData, 'investment_id'>,
  ): Promise<InvestmentTransactionEntry> {
    const existing = await prisma.investmentTransaction.findUnique({
      where: { id },
      select: { investment_id: true },
    });
    if (!existing) throw new NotFoundError('Aporte não encontrado');
    await requireInvestment(existing.investment_id);

    const updated = await prisma.investmentTransaction.update({
      where: { id },
      data: {
        ...(data.type ? { type: data.type } : {}),
        date: parseLocalDate(data.date),
        amount: data.amount,
      },
    });
    return {
      id: updated.id,
      investment_id: updated.investment_id,
      type: updated.type,
      date: formatLocalDate(updated.date),
      amount: Number(updated.amount),
    };
  }

  async deleteTransaction(id: string): Promise<void> {
    const existing = await prisma.investmentTransaction.findUnique({
      where: { id },
      select: { investment_id: true },
    });
    if (!existing) throw new NotFoundError('Aporte não encontrado');
    await requireInvestment(existing.investment_id);
    await prisma.investmentTransaction.delete({ where: { id } });
  }

  async setMonthBalance(investmentId: string, year: number, month: number, balance: number): Promise<void> {
    await requireInvestment(investmentId);
    await prisma.investmentMonthBalance.upsert({
      where: { investment_id_year_month: { investment_id: investmentId, year, month } },
      update: { balance },
      create: { investment_id: investmentId, year, month, balance },
    });
  }

  async clearMonthBalance(investmentId: string, year: number, month: number): Promise<void> {
    await requireInvestment(investmentId);
    await prisma.investmentMonthBalance.deleteMany({
      where: { investment_id: investmentId, year, month },
    });
  }

  async getFilters(): Promise<Record<string, unknown>> {
    const records = await prisma.investment.findMany({
      where: { deleted_at: null },
      select: {
        partition: true,
        issuer: true,
        product: true,
        product_type: true,
        financial_institution_id: true,
        financial_institution: { select: { name: true } },
      },
      orderBy: { created_at: 'asc' },
    });

    const uniqueOptions = (values: string[]) =>
      Array.from(new Set(values.filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, 'pt-BR'))
        .map((value) => ({ label: value, value }));

    const institutionMap = new Map<string, string>();
    for (const record of records) {
      const label = `${record.financial_institution?.name ?? ''} - ${record.partition}`;
      institutionMap.set(record.financial_institution_id, label);
    }

    return {
      filters: [
        {
          field: 'financial_institution_id',
          type: 'select',
          label: 'Inst. Financeira - Partição',
          values: Array.from(institutionMap.entries())
            .map(([value, label]) => ({ label, value }))
            .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
          searchable: true,
        },
        { field: 'issuer', type: 'select', label: 'Emissor', values: uniqueOptions(records.map((r) => r.issuer)), searchable: true },
        { field: 'product', type: 'select', label: 'Produto', values: uniqueOptions(records.map((r) => r.product)), searchable: true },
        {
          field: 'product_type',
          type: 'select',
          label: 'Tipo do Produto',
          values: Array.from(new Set(records.map((r) => r.product_type))).map((value) => ({
            label: INVESTMENT_PRODUCT_TYPE_LABELS[value as InvestmentProductType] ?? value,
            value,
          })),
          searchable: true,
        },
        {
          field: 'is_liquidated',
          type: 'select',
          label: 'Investimento liquidado',
          values: [
            { label: 'Sim', value: 'true' },
            { label: 'Não', value: 'false' },
          ],
        },
        { field: 'maturity_date', type: 'date', label: 'Vencimento', dateRange: true },
        { field: 'application_date', type: 'date', label: 'Data da aplicação', dateRange: true },
      ],
      operators: {},
      defaultSort: 'display_order:asc',
      searchFields: ['issuer', 'product'],
    };
  }

  async getSettings(): Promise<InvestmentSettings> {
    const companyId = getCurrentCompanyId();
    if (!companyId) return { independence_reference_amount: null };

    const settings = await prisma.investmentSettings.findUnique({ where: { company_id: companyId } });
    return {
      independence_reference_amount:
        settings?.independence_reference_amount != null ? Number(settings.independence_reference_amount) : null,
    };
  }

  async saveSettings(data: InvestmentSettings): Promise<InvestmentSettings> {
    const companyId = getCurrentCompanyId();
    if (!companyId) throw new NotFoundError('Contexto de empresa não identificado');

    const saved = await prisma.investmentSettings.upsert({
      where: { company_id: companyId },
      update: { independence_reference_amount: data.independence_reference_amount },
      create: { company_id: companyId, independence_reference_amount: data.independence_reference_amount },
    });

    return {
      independence_reference_amount:
        saved.independence_reference_amount != null ? Number(saved.independence_reference_amount) : null,
    };
  }
}
