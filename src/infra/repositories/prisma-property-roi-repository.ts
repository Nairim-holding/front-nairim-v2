import prisma from '@/infra/database/prisma';
import {
  ROI_LINE_DEFINITIONS,
  ROI_LINE_KEYS,
  computePropertyRoi,
  leasedMonths,
  maintenanceCutoffDate,
  missingRoiLines,
  normalizeRoiLines,
  referencePeriodMonths,
  splitMaintenance,
  suggestRoiLines,
  type RoiCategoryOption,
  type RoiDatedAmount,
  type RoiLineKey,
  type RoiLines,
  type RoiPropertyRow,
  type RoiPropertyInput,
  type RoiReport,
  type RoiSettingsView,
  type RoiWarning,
} from '@/core/entities/property-roi';
import {
  buildRoiOrigin,
  type RoiMetricKey,
  type RoiOrigin,
  type RoiOriginContext,
  type RoiTransactionOriginSource,
} from '@/core/entities/property-roi-origin';
import { NotFoundError, ValidationError } from '@/core/errors/domain-errors';

/**
 * Dados do ROI por imóvel. Tenant-scoped: `RoiSettings` está em TENANT_MODELS
 * e as leituras de imóvel/lançamento passam pela extensão multi-tenant.
 *
 * Vínculo lançamento → imóvel: pelo centro, como manda a planilha do cliente —
 * aluguel no Centro de Receita (`center_id`) e despesas no Centro de Custo
 * (`debit_center_id`; sem ele, o mesmo centro de receita, igual à geração da
 * comissão em prisma-lease-finance-repository). Centro usado por mais de um
 * imóvel não é atribuído a nenhum, para não misturar valores.
 *
 * Só entram lançamentos realizados (COMPLETED), pela data de efetivação.
 *
 * Camada: infra.
 */

export interface RoiReportParams {
  from: string;
  to: string;
  propertyIds?: string[];
  /** Data de hoje (ISO), para contar os meses locado. */
  today: string;
}

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

export class PrismaPropertyRoiRepository {
  private async listCategories(companyId: string): Promise<RoiCategoryOption[]> {
    const categories = await prisma.category.findMany({
      where: { company_id: companyId, deleted_at: null },
      select: {
        id: true, name: true, type: true,
        subcategories: { where: { company_id: companyId, deleted_at: null }, select: { id: true, name: true }, orderBy: { name: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });
    return categories;
  }

  /** Linhas salvas pela empresa ou, na falta delas, a sugestão pelos nomes da planilha. */
  private async resolveLines(companyId: string, categories: RoiCategoryOption[]): Promise<{ lines: RoiLines; saved: boolean }> {
    const settings = await prisma.roiSettings.findUnique({ where: { company_id: companyId } });
    if (settings) return { lines: normalizeRoiLines(settings.lines), saved: true };
    return { lines: suggestRoiLines(categories), saved: false };
  }

  async getSettings(companyId: string): Promise<RoiSettingsView> {
    const categories = await this.listCategories(companyId);
    const { lines, saved } = await this.resolveLines(companyId, categories);
    return { lines, saved, categories };
  }

  async saveSettings(companyId: string, raw: unknown): Promise<RoiSettingsView> {
    const lines = normalizeRoiLines(raw);
    const categories = await this.listCategories(companyId);
    const byId = new Map(categories.map((category) => [category.id, category]));

    // As categorias vêm já filtradas pela empresa: um ID de fora não é aceito.
    for (const definition of ROI_LINE_DEFINITIONS) {
      const line = lines[definition.key];
      if (!line.category_id) continue;
      const category = byId.get(line.category_id);
      if (!category) throw new ValidationError(`Categoria inválida para "${definition.label}".`);
      const expectedType = definition.side === 'income' ? 'INCOME' : 'EXPENSE';
      if (category.type !== expectedType) {
        throw new ValidationError(`"${definition.label}" precisa de uma categoria de ${expectedType === 'INCOME' ? 'Receita' : 'Despesa'}.`);
      }
      if (line.subcategory_id && !category.subcategories.some((sub) => sub.id === line.subcategory_id)) {
        throw new ValidationError(`Subcategoria inválida para "${definition.label}".`);
      }
    }

    await prisma.roiSettings.upsert({
      where: { company_id: companyId },
      update: { lines },
      create: { company_id: companyId, lines },
    });
    return { lines, saved: true, categories };
  }

  async getReport(params: RoiReportParams, companyId: string): Promise<RoiReport> {
    return (await this.buildReport(params, companyId)).report;
  }

  async getOrigin(params: RoiReportParams & { metric: RoiMetricKey }, companyId: string): Promise<RoiOrigin> {
    const { report, contexts } = await this.buildReport(params, companyId);
    return buildRoiOrigin(report, contexts, params.metric);
  }

  /** O relatório e sua memória de cálculo usam a mesma consulta, filtros e entradas. */
  private async buildReport(params: RoiReportParams, companyId: string): Promise<{ report: RoiReport; contexts: RoiOriginContext[] }> {
    const categories = await this.listCategories(companyId);
    const { lines, saved } = await this.resolveLines(companyId, categories);

    const allProperties = await prisma.property.findMany({
      where: { company_id: companyId, deleted_at: null },
      select: {
        id: true, title: true, center_id: true, debit_center_id: true,
        values: {
          where: { deleted_at: null },
          orderBy: { created_at: 'desc' },
          take: 1,
          select: { id: true, purchase_value: true, purchase_date: true, vacancy_months_per_year: true },
        },
        leases: {
          where: { company_id: companyId, deleted_at: null },
          select: { id: true, contract_number: true, start_date: true, end_date: true, canceled_at: true },
        },
      },
      orderBy: { title: 'asc' },
    });

    const availableProperties = allProperties.map((property) => ({ id: property.id, title: property.title }));
    const selected = new Set((params.propertyIds ?? []).filter((id) => id.trim() !== ''));
    if ([...selected].some((id) => !allProperties.some((property) => property.id === id))) {
      throw new NotFoundError('Imóvel não encontrado.');
    }
    const considered = selected.size > 0 ? allProperties.filter((property) => selected.has(property.id)) : allProperties;

    // Um centro só vale para o ROI quando pertence a um único imóvel — a
    // contagem considera todo o portfólio, não só os imóveis selecionados.
    const incomeCenterUse = new Map<string, number>();
    const costCenterUse = new Map<string, number>();
    const costCenterOf = (property: { center_id: string | null; debit_center_id: string | null }) => property.debit_center_id ?? property.center_id;
    for (const property of allProperties) {
      if (property.center_id) incomeCenterUse.set(property.center_id, (incomeCenterUse.get(property.center_id) ?? 0) + 1);
      const costCenter = costCenterOf(property);
      if (costCenter) costCenterUse.set(costCenter, (costCenterUse.get(costCenter) ?? 0) + 1);
    }

    const centerIds = [...new Set(considered.flatMap((property) => [property.center_id, costCenterOf(property)]).filter((id): id is string => !!id))];
    const configured = ROI_LINE_KEYS.filter((key) => lines[key].category_id);

    const transactions = centerIds.length === 0 || configured.length === 0 ? [] : await prisma.transaction.findMany({
      where: {
        company_id: companyId,
        deleted_at: null,
        status: 'COMPLETED',
        is_transfer: false,
        center_id: { in: centerIds },
        OR: configured.map((key) => ({
          category_id: lines[key].category_id as string,
          ...(lines[key].subcategory_id ? { subcategory_id: lines[key].subcategory_id } : {}),
        })),
      },
      select: {
        id: true, center_id: true, category_id: true, subcategory_id: true, amount: true,
        effective_date: true, event_date: true, description: true,
        category: { select: { id: true, name: true, company_id: true } },
        subcategory: { select: { id: true, name: true, company_id: true } },
        center: { select: { id: true, name: true, company_id: true } },
        financial_institution: { select: { id: true, name: true, company_id: true } },
      },
      orderBy: [{ effective_date: 'asc' }, { id: 'asc' }],
    });

    // centro → linha → lançamentos datados.
    type Entry = RoiDatedAmount & { source: RoiTransactionOriginSource };
    const byCenter = new Map<string, Map<RoiLineKey, Entry[]>>();
    for (const tx of transactions) {
      if (!tx.center_id) continue;
      for (const key of configured) {
        const line = lines[key];
        if (tx.category_id !== line.category_id) continue;
        if (line.subcategory_id && tx.subcategory_id !== line.subcategory_id) continue;
        let centerLines = byCenter.get(tx.center_id);
        if (!centerLines) { centerLines = new Map(); byCenter.set(tx.center_id, centerLines); }
        const list = centerLines.get(key) ?? [];
        const ownedReference = (reference: { id: string; name: string; company_id: string } | null) =>
          reference?.company_id === companyId ? { id: reference.id, name: reference.name } : null;
        const category = categories.find((candidate) => candidate.id === tx.category_id);
        const subcategory = category?.subcategories.find((candidate) => candidate.id === tx.subcategory_id);
        list.push({
          date: isoDate(tx.effective_date), amount: Number(tx.amount),
          source: {
            kind: 'transaction', id: tx.id, date: isoDate(tx.effective_date), eventDate: isoDate(tx.event_date),
            description: tx.description, amount: Number(tx.amount), lineKeys: [key],
            category: ownedReference(tx.category) ?? { id: tx.category_id, name: category?.name ?? '' },
            subcategory: ownedReference(tx.subcategory) ?? (subcategory ? { id: subcategory.id, name: subcategory.name } : null),
            center: ownedReference(tx.center), institution: ownedReference(tx.financial_institution),
          },
        });
        centerLines.set(key, list);
      }
    }

    const period = { from: params.from, to: params.to };
    const periodMonths = referencePeriodMonths(params.from, params.to);
    const inPeriod = (entry: RoiDatedAmount) => entry.date >= period.from && entry.date <= period.to;
    const sum = (entries: RoiDatedAmount[]) => entries.reduce((total, entry) => total + entry.amount, 0);

    const contexts: RoiOriginContext[] = considered.map((property) => {
      const value = property.values[0];
      const warnings: RoiWarning[] = [];
      const purchaseValue = value?.purchase_value != null ? Number(value.purchase_value) : null;
      const purchaseDate = value?.purchase_date ? isoDate(value.purchase_date) : null;
      if (!purchaseValue) warnings.push('NO_PURCHASE_VALUE');
      if (!purchaseDate) warnings.push('NO_PURCHASE_DATE');

      let incomeCenter = property.center_id;
      if (!incomeCenter) warnings.push('NO_INCOME_CENTER');
      else if ((incomeCenterUse.get(incomeCenter) ?? 0) > 1) { warnings.push('SHARED_INCOME_CENTER'); incomeCenter = null; }

      let costCenter = costCenterOf(property);
      if (!costCenter) warnings.push('NO_COST_CENTER');
      else if ((costCenterUse.get(costCenter) ?? 0) > 1) { warnings.push('SHARED_COST_CENTER'); costCenter = null; }

      const income = (key: RoiLineKey) => (incomeCenter ? byCenter.get(incomeCenter)?.get(key) : undefined) ?? [];
      const cost = (key: RoiLineKey) => (costCenter ? byCenter.get(costCenter)?.get(key) : undefined) ?? [];

      const leaseSources = property.leases.map((lease) => ({
        kind: 'lease' as const, id: lease.id, contractNumber: lease.contract_number,
        start: isoDate(lease.start_date),
        end: isoDate(lease.end_date),
        canceledAt: lease.canceled_at ? isoDate(lease.canceled_at) : null,
        consideredEnd: [isoDate(lease.end_date), ...(lease.canceled_at ? [isoDate(lease.canceled_at)] : []), params.today].sort()[0],
      }));
      const monthsLeased = leasedMonths(leaseSources, params.today);
      if (monthsLeased === 0) warnings.push('NEVER_LEASED');

      const maintenance = splitMaintenance(cost('maintenance'), purchaseDate, period);
      const rentReceived = sum(income('rent'));

      const input: RoiPropertyInput = {
        purchaseValue,
        vacancyMonths: value?.vacancy_months_per_year != null ? Number(value.vacancy_months_per_year) : null,
        monthsLeased,
        itbi: sum(cost('itbi')),
        registry: sum(cost('registry')),
        initialRenovation: maintenance.initial,
        rentReceived,
        iptu: sum(cost('iptu').filter(inPeriod)),
        insurance: sum(cost('insurance').filter(inPeriod)),
        commission: sum(cost('commission').filter(inPeriod)),
        periodicMaintenance: maintenance.periodic,
        periodMonths,
      };
      const result = computePropertyRoi(input);

      const row: RoiPropertyRow = {
        ...result,
        propertyId: property.id,
        propertyTitle: property.title,
        purchaseDate,
        monthsLeased,
        rentReceived: Math.round((rentReceived + Number.EPSILON) * 100) / 100,
        warnings,
      };
      const cutoff = maintenanceCutoffDate(purchaseDate);
      const isInitial = (entry: Entry) => cutoff !== null && entry.date <= cutoff;
      const sources = (entries: Entry[]) => entries.map((entry) => entry.source);
      return {
        row, input,
        propertySource: {
          kind: 'property', id: property.id, valueId: value?.id ?? null,
          fields: [
            { key: 'purchaseValue', label: 'Valor de compra cadastrado', value: purchaseValue, unit: 'currency' },
            { key: 'purchaseDate', label: 'Data de compra cadastrada', value: purchaseDate, unit: 'date' },
            { key: 'vacancyMonths', label: 'Vacância prevista por ano', value: input.vacancyMonths, unit: 'months' },
          ],
        },
        leases: leaseSources.filter((lease) => lease.consideredEnd > lease.start),
        entries: {
          itbi: sources(cost('itbi')), registry: sources(cost('registry')),
          initialRenovation: sources(cost('maintenance').filter(isInitial)), rentReceived: sources(income('rent')),
          iptuAnnual: sources(cost('iptu').filter(inPeriod)), insuranceAnnual: sources(cost('insurance').filter(inPeriod)),
          commissionAnnual: sources(cost('commission').filter(inPeriod)),
          maintenanceAnnual: sources(cost('maintenance').filter((entry) => !isInitial(entry) && inPeriod(entry))),
        },
      };
    });

    return {
      report: {
        rows: contexts.map((context) => context.row),
        period: { ...period, months: periodMonths },
        missingLines: missingRoiLines(lines),
        usingSuggestedLines: !saved,
        availableProperties,
      },
      contexts,
    };
  }
}

export const prismaPropertyRoiRepository = new PrismaPropertyRoiRepository();
