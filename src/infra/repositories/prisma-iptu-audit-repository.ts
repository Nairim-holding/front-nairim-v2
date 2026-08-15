import prisma from '@/infra/database/prisma';
import type { IptuAuditRepository } from '@/core/repositories/iptu-audit-repository';
import type {
  IptuAuditParams,
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
 * O vínculo lançamento → imóvel é sempre via `lease_id` (Transaction não tem
 * property_id próprio) — tanto a restituição gerada automaticamente
 * (LeaseFinanceService) quanto o IPTU pago manualmente devem estar associados
 * a uma locação para entrar na auditoria.
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
    end.setHours(23, 59, 59, 999);

    const buildSideWhere = (categoryId: string | null, subcategoryId: string | null) => {
      if (!categoryId) return null;
      const where: Record<string, unknown> = {
        deleted_at: null,
        NOT: { is_transfer: true },
        event_date: { gte: start, lte: end },
        category_id: categoryId,
        lease_id: { not: null },
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
      lease: { select: { property: { select: { id: true, title: true } } } },
    } as const;

    const [incomeTxns, expenseTxns] = await Promise.all([
      incomeWhere ? prisma.transaction.findMany({ where: incomeWhere, select }) : Promise.resolve([]),
      expenseWhere ? prisma.transaction.findMany({ where: expenseWhere, select }) : Promise.resolve([]),
    ]);

    const rowsByProperty = new Map<string, IptuAuditRow>();

    const ensureRow = (propertyId: string, propertyTitle: string): IptuAuditRow => {
      let row = rowsByProperty.get(propertyId);
      if (!row) {
        row = { propertyId, propertyTitle, address: null, income: 0, expense: 0, balance: 0, transactions: [] };
        rowsByProperty.set(propertyId, row);
      }
      return row;
    };

    for (const t of incomeTxns) {
      const property = t.lease?.property;
      if (!property) continue;
      const row = ensureRow(property.id, property.title);
      const amount = Number(t.amount);
      row.income += amount;
      row.transactions.push({ id: t.id, description: t.description, amount, date: t.event_date.toISOString().slice(0, 10), type: 'INCOME' });
    }

    for (const t of expenseTxns) {
      const property = t.lease?.property;
      if (!property) continue;
      const row = ensureRow(property.id, property.title);
      const amount = Number(t.amount);
      row.expense += amount;
      row.transactions.push({ id: t.id, description: t.description, amount, date: t.event_date.toISOString().slice(0, 10), type: 'EXPENSE' });
    }

    const propertyIds = Array.from(rowsByProperty.keys());
    if (propertyIds.length > 0) {
      const addresses = await prisma.propertyAddress.findMany({
        where: { property_id: { in: propertyIds }, deleted_at: null },
        select: { property_id: true, address: { select: { street: true, number: true, city: true, state: true } } },
      });
      const addressByProperty = new Map(
        addresses.map((a) => [a.property_id, `${a.address.street}, ${a.address.number} - ${a.address.city}/${a.address.state}`]),
      );
      for (const row of rowsByProperty.values()) {
        row.address = addressByProperty.get(row.propertyId) ?? null;
      }
    }

    const rows = Array.from(rowsByProperty.values())
      .map((row) => {
        row.balance = row.income - row.expense;
        row.transactions.sort((a, b) => a.date.localeCompare(b.date));
        return row;
      })
      .sort((a, b) => a.propertyTitle.localeCompare(b.propertyTitle));

    const totals = rows.reduce(
      (acc, row) => ({ income: acc.income + row.income, expense: acc.expense + row.expense, balance: acc.balance + row.balance }),
      { income: 0, expense: 0, balance: 0 },
    );

    return { rows, totals };
  }
}

export const prismaIptuAuditRepository = new PrismaIptuAuditRepository();
