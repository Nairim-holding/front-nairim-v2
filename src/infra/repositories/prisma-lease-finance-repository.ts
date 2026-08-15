import prisma from '@/infra/database/prisma';
import type { LeaseFinanceRepository } from '@/core/repositories/lease-finance-repository';
import type { LeaseScheduleItem, SyncLeaseTransactionsResult } from '@/core/entities/lease';
import { createDateLocal, parseLocalDate } from '@/shared/utils/date-utils';

/**
 * Implementação Prisma de {@link LeaseFinanceRepository}.
 * Porte fiel de api-nairim-v2/src/services/LeaseFinanceService.ts.
 *
 * Regras (definidas com o cliente — preservadas do backend):
 *  - Categoria/subcategoria: SEMPRE as do imóvel (definidas pelo usuário). Sem
 *    categoria no imóvel → não gera lançamentos.
 *  - Aluguel: 1 lançamento por mês do período (start+1..end), no rent_due_day.
 *  - Comissão: 1 lançamento por mês (se commission_amount > 0).
 *  - IPTU: 1 lançamento por parcela, conforme payment_condition.
 *  - Contato (supplier_id) = fornecedor-espelho da imobiliária vinculada.
 *  - Centro de custo (center_id) = centro do imóvel, quando houver.
 *
 * Idempotência: cada transação gerada carrega lease_id + (category_id,
 * installment_number). Ao re-sincronizar, as PENDING geradas são removidas e
 * recriadas; as COMPLETED são preservadas e seus períodos não são duplicados.
 *
 * Camada: infra.
 */
export class PrismaLeaseFinanceRepository implements LeaseFinanceRepository {
  /** Lista de {year, month(1-12)} de start a end, inclusive, mês a mês. */
  private monthsBetween(start: Date, end: Date): { year: number; month: number }[] {
    const s = parseLocalDate(start);
    const e = parseLocalDate(end);
    const out: { year: number; month: number }[] = [];
    let y = s.getUTCFullYear();
    let m = s.getUTCMonth() + 1;
    const endY = e.getUTCFullYear();
    const endM = e.getUTCMonth() + 1;
    // Guarda contra ranges inválidos/imensos.
    let guard = 0;
    while ((y < endY || (y === endY && m <= endM)) && guard < 600) {
      out.push({ year: y, month: m });
      m++;
      if (m > 12) { m = 1; y++; }
      guard++;
    }
    return out;
  }

  /** Cria data no dia desejado, ajustando para o último dia do mês quando necessário. */
  private dueDate(year: number, month: number, day: number): Date {
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const safeDay = Math.min(Math.max(day || 1, 1), lastDay);
    return createDateLocal(year, month, safeDay);
  }

  /** Resolve (find-or-create) o fornecedor-espelho da imobiliária. */
  private async resolveAgencySupplier(agencyId: string, companyId: string): Promise<string | null> {
    const existing = await prisma.supplier.findFirst({ where: { agency_id: agencyId, company_id: companyId, deleted_at: null } });
    if (existing) return existing.id;

    const agency = await prisma.agency.findUnique({ where: { id: agencyId } });
    if (!agency) return null;

    // internal_code determinístico e único por imobiliária (a constraint
    // @@unique([company_id, internal_code]) trata NULLs como iguais nesta base,
    // então não dá para usar NULL). Identificação real do mirror é por agency_id.
    const supplier = await prisma.supplier.create({
      data: {
        legal_name: agency.legal_name,
        trade_name: agency.trade_name,
        cnpj: agency.cnpj,
        internal_code: `AG-${agencyId.slice(0, 8)}`,
        created_via: 'agency_mirror',
        is_active: true,
        agency: { connect: { id: agencyId } },
        company: { connect: { id: companyId } },
      },
    });
    return supplier.id;
  }

  /** Monta as parcelas de IPTU conforme a condição de pagamento da locação. */
  private buildIptuItems(lease: any, categoryId: string, subcategoryId: string | null, centerId: string | null): LeaseScheduleItem[] {
    const year = lease.iptu_year || new Date().getUTCFullYear();
    const taxDay = lease.tax_due_day || 10;
    const items: { amount: number; date: Date }[] = [];

    const num = (v: any) => (v != null ? Number(v) : 0);
    const round2 = (v: number) => Math.round(v * 100) / 100;
    const base = num(lease.property_tax);

    switch (lease.payment_condition) {
      case 'IN_FULL_15_DISCOUNT': {
        // À vista com 15% de desconto → 1 único lançamento já descontado.
        // Usa o valor informado; se ausente, calcula base × 0,85.
        const informed = num(lease.property_tax_cash);
        const amount = informed > 0 ? round2(informed) : round2(base * 0.85);
        if (amount > 0) {
          const date = lease.property_tax_cash_due_date ? parseLocalDate(lease.property_tax_cash_due_date) : this.dueDate(year, 1, taxDay);
          items.push({ amount, date });
        }
        break;
      }
      case 'SECOND_INSTALLMENT_10_DISCOUNT': {
        // 2 parcelas com 10% de desconto → 2 lançamentos com datas individuais.
        // Fallback: base × 0,90 dividido em 2 parcelas iguais.
        const amt1 = num(lease.property_tax_first_installment);
        const amt2 = num(lease.property_tax_second_installment);
        const half = round2(base * 0.45);
        const a1 = amt1 > 0 ? round2(amt1) : half;
        const a2 = amt2 > 0 ? round2(amt2) : half;
        const d1 = lease.property_tax_first_installment_due_date ? parseLocalDate(lease.property_tax_first_installment_due_date) : this.dueDate(year, 1, taxDay);
        const d2 = lease.property_tax_second_installment_due_date ? parseLocalDate(lease.property_tax_second_installment_due_date) : this.dueDate(year, 2, taxDay);
        if (a1 > 0) items.push({ amount: a1, date: d1 });
        if (a2 > 0) items.push({ amount: a2, date: d2 });
        break;
      }
      case 'INSTALLMENTS': {
        const amounts: any[] = Array.isArray(lease.iptu_installments) ? lease.iptu_installments : [];
        const dueDates: any[] = Array.isArray(lease.iptu_installments_due_dates) ? lease.iptu_installments_due_dates : [];
        amounts.forEach((a, idx) => {
          const amount = num(a);
          if (amount <= 0) return;
          const rawDate = dueDates[idx];
          const date = rawDate ? parseLocalDate(rawDate) : this.dueDate(year, (idx % 12) + 1, taxDay);
          items.push({ amount, date });
        });
        break;
      }
      default:
        break;
    }

    return items.map((it, idx) => ({
      category_id: categoryId,
      subcategory_id: subcategoryId,
      center_id: centerId,
      amount: it.amount,
      date: it.date,
      installment_number: idx + 1,
      total: items.length,
      description: `Restituição IPTU ${idx + 1}/${items.length} - Contrato ${lease.contract_number}`,
    }));
  }

  /** @inheritdoc */
  async syncLeaseTransactions(leaseId: string, companyId: string): Promise<SyncLeaseTransactionsResult> {
    const lease = await prisma.lease.findUnique({
      where: { id: leaseId },
      include: {
        property: { select: { center_id: true, debit_center_id: true, category_id: true, subcategory_id: true, iptu_refund_category_id: true, iptu_refund_subcategory_id: true } },
        agency: { select: { commission_category_id: true, commission_subcategory_id: true } },
        tenant: { select: { name: true } },
      },
    });
    if (!lease || lease.deleted_at) return { generated: 0 };

    // Locação cancelada não regenera lançamentos: os futuros foram excluídos no
    // fluxo de cancelamento e não devem voltar.
    if (lease.status === 'CANCELED') return { generated: 0 };

    if (!lease.financial_institution_id) {
      return { generated: 0, warning: 'Lançamentos financeiros não gerados: selecione uma instituição financeira na locação.' };
    }

    // 1. Categoria/subcategoria do imóvel (definidas pelo usuário). Obrigatórias.
    const propCategoryId = lease.property?.category_id ?? null;
    const propSubcategoryId = lease.property?.subcategory_id ?? null;
    if (!propCategoryId) {
      return { generated: 0, warning: 'Selecione uma categoria no imóvel antes de gerar os lançamentos da locação.' };
    }

    // Categoria da comissão = categoria da imobiliária; fallback: a do imóvel.
    const commissionCategoryId = lease.agency?.commission_category_id ?? propCategoryId;
    const commissionSubcategoryId = lease.agency?.commission_category_id ? (lease.agency.commission_subcategory_id ?? null) : propSubcategoryId;

    // 2. Fornecedor-espelho + centros de custo (crédito=receitas, débito=comissão).
    const supplierId = lease.agency_id ? await this.resolveAgencySupplier(lease.agency_id, companyId) : null;
    const creditCenterId = lease.property?.center_id ?? null;
    const debitCenterId = lease.property?.debit_center_id ?? creditCenterId;

    // 3. Schedule desejado — o primeiro lançamento é gerado 1 mês APÓS o início
    // (monthsBetween é inclusivo do mês inicial → slice(1)).
    const items: LeaseScheduleItem[] = [];
    const months = this.monthsBetween(lease.start_date, lease.end_date).slice(1);
    const rentAmount = Number(lease.rent_amount);
    const commissionAmount = lease.commission_amount ? Number(lease.commission_amount) : 0;
    const tenantName = lease.tenant?.name ?? 'Inquilino';

    months.forEach((m, idx) => {
      const date = this.dueDate(m.year, m.month, lease.rent_due_day);
      items.push({
        category_id: propCategoryId,
        subcategory_id: propSubcategoryId,
        center_id: creditCenterId,
        amount: rentAmount,
        date,
        installment_number: idx + 1,
        total: months.length,
        description: `Aluguel do imóvel ${idx + 1}/${months.length} – ${tenantName} – Contrato ${lease.contract_number}`,
      });
      if (commissionAmount > 0) {
        items.push({
          category_id: commissionCategoryId,
          subcategory_id: commissionSubcategoryId,
          center_id: debitCenterId,
          amount: commissionAmount,
          date,
          installment_number: idx + 1,
          total: months.length,
          description: `Comissão ${idx + 1}/${months.length} - Contrato ${lease.contract_number}`,
        });
      }
    });

    // IPTU (Restituição): categoria PRÓPRIA de restituição do imóvel; fallback: a do imóvel.
    const iptuCategoryId = lease.property?.iptu_refund_category_id ?? propCategoryId;
    const iptuSubcategoryId = lease.property?.iptu_refund_category_id ? (lease.property.iptu_refund_subcategory_id ?? null) : propSubcategoryId;
    items.push(...this.buildIptuItems(lease, iptuCategoryId, iptuSubcategoryId, creditCenterId));

    // 4. Idempotência: chave por 1ª palavra da descrição (Aluguel/Comissão/Restituição) + parcela.
    const keyOf = (desc: string | null, inst: number | null) => `${String(desc ?? '').split(' ')[0]}::${inst ?? 0}`;

    const existing = await prisma.transaction.findMany({
      // Encargos de cancelamento (is_cancellation_charge) NÃO fazem parte do
      // schedule gerado — nunca são apagados nem duplicados pelo sync.
      where: { lease_id: leaseId, deleted_at: null, is_cancellation_charge: false },
      select: { id: true, status: true, description: true, installment_number: true },
    });
    const completedKeys = new Set(existing.filter((t) => t.status === 'COMPLETED').map((t) => keyOf(t.description, t.installment_number)));
    const pendingIds = existing.filter((t) => t.status !== 'COMPLETED').map((t) => t.id);

    if (pendingIds.length > 0) {
      await prisma.transaction.updateMany({ where: { id: { in: pendingIds } }, data: { deleted_at: new Date() } });
    }

    // 5. Cria apenas o que não está coberto por uma transação COMPLETED.
    const toCreate = items.filter((it) => !completedKeys.has(keyOf(it.description, it.installment_number)));

    for (const it of toCreate) {
      await prisma.transaction.create({
        data: {
          event_date: it.date,
          effective_date: it.date,
          description: it.description,
          amount: it.amount,
          status: 'PENDING',
          category_id: it.category_id,
          subcategory_id: it.subcategory_id ?? null,
          financial_institution_id: lease.financial_institution_id,
          supplier_id: supplierId,
          center_id: it.center_id ?? null,
          lease_id: leaseId,
          installment_number: it.installment_number,
          total_installments: it.total,
          company_id: companyId,
        },
      });
    }

    return { generated: toCreate.length };
  }
}
