import prisma from '@/infra/database/prisma';
import type { IptuAuditRepository } from '@/core/repositories/iptu-audit-repository';
import type {
  IptuAuditParams,
  IptuAuditPeriodPoint,
  IptuAuditReport,
  IptuAuditRow,
  IptuAuditSettings,
  IptuAuditSettingsInput,
} from '@/core/entities/iptu-audit';
import { parseLocalDate } from '@/shared/utils/date-utils';
import { ValidationError } from '@/core/errors/domain-errors';

/**
 * Implementação Prisma de {@link IptuAuditRepository}.
 * Porte de api-nairim-v2/src/services/AuditService.ts.
 * Tenant-scoped: `IptuAuditSettings` está em TENANT_MODELS.
 *
 * Vínculo lançamento → imóvel (Tarefa 4.1): `Transaction` não tem
 * `property_id`, então a ligação é feita por `lease_id` (restituição gerada
 * pelo LeaseFinanceService) OU pelo centro do lançamento, casando com o
 * `center_id`/`debit_center_id` do imóvel. Antes só o `lease_id` valia, e o
 * IPTU pago manualmente — que não tem locação — ficava fora da apuração;
 * daí o "só considera um ou dois imóveis" relatado pelo cliente.
 *
 * Camada: infra.
 */
export class PrismaIptuAuditRepository implements IptuAuditRepository {
  async getSettings(companyId: string): Promise<IptuAuditSettings | null> {
    return prisma.iptuAuditSettings.findUnique({
      where: { company_id: companyId },
      include: {
        income_category: { select: { id: true, name: true } },
        income_subcategory: { select: { id: true, name: true } },
        expense_category: { select: { id: true, name: true } },
        expense_subcategory: { select: { id: true, name: true } },
      },
    });
  }

  async saveSettings(companyId: string, input: IptuAuditSettingsInput): Promise<IptuAuditSettings> {
    const data = {
      income_category_id: input.income_category_id || null,
      income_subcategory_id: input.income_subcategory_id || null,
      expense_category_id: input.expense_category_id || null,
      expense_subcategory_id: input.expense_subcategory_id || null,
    };

    const saved = await prisma.iptuAuditSettings.upsert({
      where: { company_id: companyId },
      update: data,
      create: { company_id: companyId, ...data },
    });

    // O upsert não traz os includes de categoria/subcategoria (assimetria com
    // getSettings já presente no backend original) — o front não depende
    // deste retorno para popular a UI, só usa o payload que ele mesmo enviou.
    return saved as IptuAuditSettings;
  }

  async getAudit(params: IptuAuditParams, companyId: string): Promise<IptuAuditReport> {
    const settings = await prisma.iptuAuditSettings.findUnique({ where: { company_id: companyId } });
    if (!settings || (!settings.income_category_id && !settings.expense_category_id)) {
      throw new ValidationError('Configure as categorias de Receita e Despesa da Auditoria de IPTU antes de gerar o relatório.');
    }

    const start = parseLocalDate(params.startDate);
    const end = parseLocalDate(params.endDate);

    // 1. Busca TODOS os imóveis ativos do tenant para garantir apuração completa
    const allProperties = await prisma.property.findMany({
      where: { deleted_at: null },
      select: {
        id: true,
        title: true,
        center_id: true,
        debit_center_id: true,
        addresses: {
          where: { deleted_at: null },
          select: { address: { select: { street: true, number: true, city: true, state: true } } },
        },
      },
      orderBy: { title: 'asc' },
    });

    // Lista completa para o filtro da tela — não sofre o recorte do próprio filtro.
    const availableProperties = allProperties.map((p) => ({ id: p.id, title: p.title }));

    // Filtro de imóveis da tela: vazio/ausente = todos.
    const selectedIds = (params.propertyIds ?? []).filter((id) => typeof id === 'string' && id.trim() !== '');
    const hasPropertyFilter = selectedIds.length > 0;
    const selectedSet = new Set(selectedIds);
    const consideredProperties = hasPropertyFilter
      ? allProperties.filter((p) => selectedSet.has(p.id))
      : allProperties;

    const rowsByProperty = new Map<string, IptuAuditRow>();
    const centerToPropertyId = new Map<string, string>();

    for (const p of consideredProperties) {
      const addr = p.addresses[0]?.address;
      const addressStr = addr ? `${addr.street}, ${addr.number} - ${addr.city}/${addr.state}` : null;
      rowsByProperty.set(p.id, {
        propertyId: p.id,
        propertyTitle: p.title,
        address: addressStr,
        income: 0,
        expense: 0,
        balance: 0,
        transactions: [],
      });
      if (p.center_id) centerToPropertyId.set(p.center_id, p.id);
      if (p.debit_center_id) centerToPropertyId.set(p.debit_center_id, p.id);
    }

    const buildSideWhere = (categoryId: string | null, subcategoryId: string | null) => {
      if (!categoryId) return null;
      const where: Record<string, unknown> = {
        deleted_at: null,
        NOT: { is_transfer: true },
        effective_date: { gte: start, lte: end },
        category_id: categoryId,
      };
      if (subcategoryId) where.subcategory_id = subcategoryId;
      return where;
    };

    const incomeWhere = buildSideWhere(settings.income_category_id, settings.income_subcategory_id);
    const expenseWhere = buildSideWhere(settings.expense_category_id, settings.expense_subcategory_id);

    const select = {
      id: true,
      description: true,
      amount: true,
      event_date: true,
      effective_date: true,
      center_id: true,
      lease: { select: { property: { select: { id: true, title: true } } } },
    } as const;

    const [incomeTxns, expenseTxns] = await Promise.all([
      incomeWhere ? prisma.transaction.findMany({ where: incomeWhere, select }) : Promise.resolve([]),
      expenseWhere ? prisma.transaction.findMany({ where: expenseWhere, select }) : Promise.resolve([]),
    ]);

    for (const t of incomeTxns) {
      const propId = t.lease?.property?.id || (t.center_id ? centerToPropertyId.get(t.center_id) : null);
      if (!propId) continue;
      const row = rowsByProperty.get(propId);
      if (!row) continue;
      const amount = Number(t.amount);
      row.income += amount;
      const txDate = (t.effective_date ?? t.event_date).toISOString().slice(0, 10);
      row.transactions.push({ id: t.id, description: t.description, amount, date: txDate, type: 'INCOME' });
    }

    for (const t of expenseTxns) {
      const propId = t.lease?.property?.id || (t.center_id ? centerToPropertyId.get(t.center_id) : null);
      if (!propId) continue;
      const row = rowsByProperty.get(propId);
      if (!row) continue;
      const amount = Number(t.amount);
      row.expense += amount;
      const txDate = (t.effective_date ?? t.event_date).toISOString().slice(0, 10);
      row.transactions.push({ id: t.id, description: t.description, amount, date: txDate, type: 'EXPENSE' });
    }

    const rows = Array.from(rowsByProperty.values())
      .map((row) => {
        row.balance = row.income - row.expense;
        row.transactions.sort((a, b) => a.date.localeCompare(b.date));
        return row;
      })
      // Imóvel sem nenhum lançamento de IPTU no período só aparece quando o
      // usuário o escolheu explicitamente no filtro — caso contrário a tabela
      // encheria de linhas zeradas de todo o portfólio.
      .filter((row) => hasPropertyFilter || row.income !== 0 || row.expense !== 0)
      .sort((a, b) => a.propertyTitle.localeCompare(b.propertyTitle, 'pt-BR'));

    const totals = rows.reduce(
      (acc, row) => ({ income: acc.income + row.income, expense: acc.expense + row.expense, balance: acc.balance + row.balance }),
      { income: 0, expense: 0, balance: 0 },
    );

    const { monthly, yearly } = buildPeriodSeries(rows);

    return { rows, totals, monthly, yearly, availableProperties };
  }
}

const MONTH_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/**
 * Comparativo pagamento do IPTU pela empresa (despesa) x restituição pelos
 * inquilinos (receita), por mês e por ano — é o que revela se os repasses
 * estão corretos ou se há prejuízo (Tarefa 4.1).
 */
function buildPeriodSeries(rows: IptuAuditRow[]): {
  monthly: IptuAuditPeriodPoint[];
  yearly: IptuAuditPeriodPoint[];
} {
  const monthMap = new Map<string, IptuAuditPeriodPoint>();
  const yearMap = new Map<string, IptuAuditPeriodPoint>();

  const bump = (
    map: Map<string, IptuAuditPeriodPoint>,
    key: string,
    label: string,
    type: 'INCOME' | 'EXPENSE',
    amount: number,
  ) => {
    let point = map.get(key);
    if (!point) {
      point = { key, label, income: 0, expense: 0, balance: 0 };
      map.set(key, point);
    }
    if (type === 'INCOME') point.income += amount;
    else point.expense += amount;
    point.balance = point.income - point.expense;
  };

  for (const row of rows) {
    for (const t of row.transactions) {
      const [year, month] = t.date.split('-');
      const monthIndex = Number(month) - 1;
      bump(monthMap, `${year}-${month}`, `${MONTH_ABBR[monthIndex] ?? month}/${year}`, t.type, t.amount);
      bump(yearMap, year, year, t.type, t.amount);
    }
  }

  const byKey = (a: IptuAuditPeriodPoint, b: IptuAuditPeriodPoint) => a.key.localeCompare(b.key);

  return {
    monthly: Array.from(monthMap.values()).sort(byKey),
    yearly: Array.from(yearMap.values()).sort(byKey),
  };
}

export const prismaIptuAuditRepository = new PrismaIptuAuditRepository();
