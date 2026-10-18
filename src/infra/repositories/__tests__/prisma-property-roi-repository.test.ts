import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  categoryFindMany: vi.fn(),
  settingsFindUnique: vi.fn(),
  settingsUpsert: vi.fn(),
  propertyFindMany: vi.fn(),
  transactionFindMany: vi.fn(),
}));

vi.mock('@/infra/database/prisma', () => ({
  default: {
    category: { findMany: mocks.categoryFindMany },
    roiSettings: { findUnique: mocks.settingsFindUnique, upsert: mocks.settingsUpsert },
    property: { findMany: mocks.propertyFindMany },
    transaction: { findMany: mocks.transactionFindMany },
  },
}));

import { PrismaPropertyRoiRepository } from '../prisma-property-roi-repository';
import { ROI_METRIC_KEYS, type RoiOrigin } from '@/core/entities/property-roi-origin';

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

/** Categorias com os nomes da planilha do cliente. */
const categories = [
  { id: 'imp', name: 'Impostos', type: 'EXPENSE', subcategories: [{ id: 'itbi', name: 'ITBI' }, { id: 'iptu', name: 'IPTU' }, { id: 'reg', name: 'Registro de Imóveis' }] },
  { id: 'var', name: 'Despesas Variáveis', type: 'EXPENSE', subcategories: [{ id: 'man', name: 'Manutenção de Imóveis' }, { id: 'seg', name: 'Seguros (Imóvel / Incêndios)' }] },
  { id: 'fix', name: 'Despesas Fixas', type: 'EXPENSE', subcategories: [{ id: 'com', name: 'Comissões Imobiliárias' }] },
  { id: 'rec', name: 'Receitas', type: 'INCOME', subcategories: [{ id: 'alu', name: 'Aluguéis' }] },
];

const property = (overrides: Record<string, unknown> = {}) => ({
  id: 'p1', title: 'Rua Exemplo, 1', center_id: 'cr-1', debit_center_id: 'db-1',
  values: [{ id: 'value-1', purchase_value: 350000, purchase_date: date('2020-01-10'), vacancy_months_per_year: 1 }],
  leases: [{ id: 'lease-1', contract_number: '4169/23', start_date: date('2024-10-13'), end_date: date('2025-10-13'), canceled_at: null }],
  ...overrides,
});

const tx = (center_id: string, category_id: string, subcategory_id: string, amount: number, when: string) => ({
  id: `${center_id}-${category_id}-${subcategory_id}-${when}`,
  center_id, category_id, subcategory_id, amount, effective_date: date(when), event_date: date(when),
  description: 'Descrição livre, sem vínculo presumido com o imóvel',
  category: null, subcategory: null,
  center: { id: center_id, name: `Centro ${center_id}`, company_id: 'company' },
  financial_institution: { id: 'bank-1', name: 'Banco do imóvel', company_id: 'company' },
});

/** Lançamentos que reproduzem o exemplo da planilha para o imóvel p1. */
const spreadsheetTransactions = [
  tx('db-1', 'imp', 'itbi', 10500, '2020-01-15'),
  tx('db-1', 'imp', 'reg', 4500, '2020-01-20'),
  tx('db-1', 'var', 'man', 15000, '2020-06-01'),   // reforma inicial (1º ano)
  tx('db-1', 'var', 'man', 1000, '2026-02-01'),    // manutenção periódica do período
  tx('db-1', 'var', 'man', 700, '2023-02-01'),     // periódica fora do período: não entra
  tx('cr-1', 'rec', 'alu', 26400, '2025-06-10'),
  tx('db-1', 'imp', 'iptu', 1200, '2026-03-10'),
  tx('db-1', 'imp', 'iptu', 1100, '2024-03-10'),   // IPTU de outro ano: fora do período
  tx('db-1', 'var', 'seg', 450, '2026-01-05'),
  tx('db-1', 'fix', 'com', 2640, '2026-05-05'),
  // Aluguel lançado no centro de CUSTO não é receita do imóvel.
  tx('db-1', 'rec', 'alu', 9999, '2026-05-05'),
];

const params = { from: '2025-10-14', to: '2026-10-13', today: '2026-10-13' };
const transactionIds = (origin: RoiOrigin) => origin.properties.flatMap((item) => item.sources.flatMap((source) => source.kind === 'transaction' ? [source.id] : []));

describe('repositório do ROI por imóvel', () => {
  const repository = new PrismaPropertyRoiRepository();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.categoryFindMany.mockResolvedValue(categories);
    mocks.settingsFindUnique.mockResolvedValue(null);
    mocks.propertyFindMany.mockResolvedValue([property()]);
    mocks.transactionFindMany.mockResolvedValue(spreadsheetTransactions);
  });

  it('chega aos números da planilha a partir dos lançamentos do Financeiro', async () => {
    const report = await repository.getReport(params, 'company');
    const [row] = report.rows;

    expect(row.totalInvestment).toBe(380000);
    expect(row.monthsLeased).toBe(12);
    expect(row.monthlyRent).toBe(2200);
    expect(row.netAnnualRevenue).toBe(24200);
    expect(row.totalAnnualExpenses).toBe(5290);
    expect(row.annualCashFlow).toBe(18910);
    expect(row.roi).toBeCloseTo(0.0497631, 6);
    expect(row.warnings).toEqual([]);
    // Sem configuração salva, valeu a sugestão pelos nomes das categorias.
    expect(report.usingSuggestedLines).toBe(true);
    expect(report.missingLines).toEqual([]);
  });

  it('só consulta lançamentos concluídos, sem transferências, dos centros dos imóveis', async () => {
    await repository.getReport(params, 'company');
    const { where } = mocks.transactionFindMany.mock.calls[0][0];
    expect(where).toMatchObject({ deleted_at: null, status: 'COMPLETED', is_transfer: false, center_id: { in: ['cr-1', 'db-1'] } });
    expect(where.OR).toContainEqual({ category_id: 'rec', subcategory_id: 'alu' });
  });

  it('não atribui valores de um centro usado por mais de um imóvel', async () => {
    mocks.propertyFindMany.mockResolvedValue([property(), property({ id: 'p2', title: 'Rua Exemplo, 2', center_id: 'cr-2', debit_center_id: 'db-1' })]);

    const report = await repository.getReport(params, 'company');
    const first = report.rows.find((row) => row.propertyId === 'p1')!;

    expect(first.warnings).toContain('SHARED_COST_CENTER');
    expect(first.totalAnnualExpenses).toBe(0);
    expect(first.itbi).toBe(0);
    // A receita, de centro próprio, continua valendo.
    expect(first.monthlyRent).toBe(2200);
  });

  it('avisa quando faltam valor e data de compra', async () => {
    mocks.propertyFindMany.mockResolvedValue([property({ values: [] })]);

    const [row] = (await repository.getReport(params, 'company')).rows;

    expect(row.warnings).toEqual(expect.arrayContaining(['NO_PURCHASE_VALUE', 'NO_PURCHASE_DATE']));
    expect(row.roi).not.toBeNull(); // ITBI e registro ainda formam um investimento
    expect(row.capRate).toBeNull();
  });

  it('respeita o filtro de imóveis, mas lista todos no seletor', async () => {
    mocks.propertyFindMany.mockResolvedValue([property(), property({ id: 'p2', title: 'Rua Exemplo, 2', center_id: 'cr-2', debit_center_id: 'db-2' })]);

    const report = await repository.getReport({ ...params, propertyIds: ['p2'] }, 'company');

    expect(report.rows.map((row) => row.propertyId)).toEqual(['p2']);
    expect(report.availableProperties).toHaveLength(2);
  });

  it('usa a configuração salva em vez da sugestão', async () => {
    mocks.settingsFindUnique.mockResolvedValue({ lines: { rent: { category_id: 'rec', subcategory_id: 'alu' } } });

    const report = await repository.getReport(params, 'company');

    expect(report.usingSuggestedLines).toBe(false);
    expect(report.missingLines).toEqual(['itbi', 'registry', 'maintenance', 'iptu', 'insurance', 'commission']);
    expect(report.rows[0].totalAnnualExpenses).toBe(0);
  });

  it('recusa salvar categoria de outra empresa ou do tipo errado', async () => {
    await expect(repository.saveSettings('company', { rent: { category_id: 'de-fora', subcategory_id: null } })).rejects.toThrow('Categoria inválida');
    await expect(repository.saveSettings('company', { rent: { category_id: 'imp', subcategory_id: null } })).rejects.toThrow('Receita');
    await expect(repository.saveSettings('company', { iptu: { category_id: 'imp', subcategory_id: 'man' } })).rejects.toThrow('Subcategoria inválida');
    expect(mocks.settingsUpsert).not.toHaveBeenCalled();
  });

  it('salva a configuração válida', async () => {
    const view = await repository.saveSettings('company', { iptu: { category_id: 'imp', subcategory_id: 'iptu' } });
    expect(view.saved).toBe(true);
    expect(mocks.settingsUpsert.mock.calls[0][0].create.lines.iptu).toEqual({ category_id: 'imp', subcategory_id: 'iptu' });
  });

  it('explica valor de compra apenas pelo cadastro mais recente, sem misturar lançamentos ou vacância', async () => {
    const origin = await repository.getOrigin({ ...params, propertyIds: ['p1'], metric: 'purchaseValue' }, 'company');
    expect(origin.value).toBe(350000);
    expect(origin.properties[0].sources).toEqual([{
      kind: 'property', id: 'p1', valueId: 'value-1',
      fields: [{ key: 'purchaseValue', label: 'Valor de compra cadastrado', value: 350000, unit: 'currency' }],
    }]);
    expect(origin.properties[0].components).toEqual([{ key: 'purchaseValue', label: 'Valor de compra', value: 350000, unit: 'currency' }]);
    expect(JSON.parse(JSON.stringify(origin))).toEqual(origin);
  });

  it('explica despesa anual com apenas fontes do período e o fator de anualização', async () => {
    const origin = await repository.getOrigin({ ...params, from: '2024-10-14', propertyIds: ['p1'], metric: 'iptuAnnual' }, 'company');
    expect(origin.value).toBe(600);
    expect(transactionIds(origin)).toEqual(['db-1-imp-iptu-2026-03-10']);
    expect(origin.properties[0].components).toEqual([
      { key: 'iptu', label: 'Lançamentos realizados no período', value: 1200, unit: 'currency' },
      { key: 'periodMonths', label: 'Meses do período de referência', value: 24, unit: 'months' },
      { key: 'annualFactor', label: 'Fator de anualização (12 ÷ meses do período)', value: 0.5, unit: 'number' },
    ]);
    expect(origin.properties[0].sources[0]).toMatchObject({
      kind: 'transaction', date: '2026-03-10', eventDate: '2026-03-10', amount: 1200, lineKeys: ['iptu'],
      category: { id: 'imp', name: 'Impostos' }, subcategory: { id: 'iptu', name: 'IPTU' },
      center: { id: 'db-1', name: 'Centro db-1' }, institution: { id: 'bank-1', name: 'Banco do imóvel' },
    });
  });

  it('usa o corte inclusivo do primeiro ano tanto no cálculo como nas fontes da manutenção', async () => {
    mocks.transactionFindMany.mockResolvedValue([
      tx('db-1', 'var', 'man', 70, '2021-01-10'),
      tx('db-1', 'var', 'man', 30, '2021-01-11'),
      tx('db-1', 'var', 'man', 90, '2022-01-11'),
    ]);
    const period = { ...params, from: '2021-01-01', to: '2021-12-31', propertyIds: ['p1'] };
    const initial = await repository.getOrigin({ ...period, metric: 'initialRenovation' }, 'company');
    const periodic = await repository.getOrigin({ ...period, metric: 'maintenanceAnnual' }, 'company');
    expect(initial.value).toBe(70);
    expect(transactionIds(initial)).toEqual(['db-1-var-man-2021-01-10']);
    expect(periodic.value).toBe(30);
    expect(transactionIds(periodic)).toEqual(['db-1-var-man-2021-01-11']);
    expect(initial.properties[0].sources[0]).toMatchObject({ kind: 'property', fields: [{ key: 'purchaseDate', value: '2020-01-10' }] });
    expect(periodic.properties[0].sources[0]).toMatchObject({ kind: 'property', fields: [{ key: 'purchaseDate', value: '2020-01-10' }] });
  });

  it('sem data de compra, só manutenção do período é periódica e a origem explica o cadastro ausente', async () => {
    mocks.propertyFindMany.mockResolvedValue([property({ values: [{ id: 'value-1', purchase_value: 350000, purchase_date: null, vacancy_months_per_year: 1 }] })]);
    const periodic = await repository.getOrigin({ ...params, propertyIds: ['p1'], metric: 'maintenanceAnnual' }, 'company');
    expect(periodic.value).toBe(1000);
    expect(transactionIds(periodic)).toEqual(['db-1-var-man-2026-02-01']);
    expect(periodic.properties[0].warnings).toContain('NO_PURCHASE_DATE');
    expect(periodic.properties[0].sources[0]).toMatchObject({ kind: 'property', fields: [{ key: 'purchaseDate', value: null }] });
    const initial = await repository.getOrigin({ ...params, propertyIds: ['p1'], metric: 'initialRenovation' }, 'company');
    expect(initial.value).toBe(0);
    expect(transactionIds(initial)).toEqual([]);
  });

  it('origem do aluguel usa todo histórico e união dos contratos, com limite do cancelamento e de hoje', async () => {
    mocks.propertyFindMany.mockResolvedValue([property({ leases: [
      { id: 'lease-1', contract_number: '1/24', start_date: date('2024-01-01'), end_date: date('2024-12-01'), canceled_at: null },
      { id: 'lease-2', contract_number: '2/24', start_date: date('2024-06-01'), end_date: date('2025-06-01'), canceled_at: date('2025-01-01') },
      { id: 'lease-3', contract_number: '3/26', start_date: date('2026-01-01'), end_date: date('2027-01-01'), canceled_at: null },
      { id: 'future', contract_number: '4/28', start_date: date('2028-01-01'), end_date: date('2029-01-01'), canceled_at: null },
    ] })]);
    const origin = await repository.getOrigin({ ...params, today: '2026-04-01', propertyIds: ['p1'], metric: 'monthlyRent' }, 'company');
    expect(origin.value).toBe(1760); // 26400 / (12 + 3), aluguel de 2025 fora da referência é mantido
    expect(transactionIds(origin)).toEqual(['cr-1-rec-alu-2025-06-10']);
    const leases = origin.properties[0].sources.filter((source) => source.kind === 'lease');
    expect(leases.map((source) => [source.id, source.consideredEnd])).toEqual([
      ['lease-1', '2024-12-01'], ['lease-2', '2025-01-01'], ['lease-3', '2026-04-01'],
    ]);
    expect(origin.properties[0].components.find((item) => item.key === 'monthsLeased')?.value).toBe(15);
    const vacancy = await repository.getOrigin({ ...params, propertyIds: ['p1'], metric: 'vacancyMonths' }, 'company');
    expect(vacancy.properties[0].sources).toEqual([expect.objectContaining({ kind: 'property', fields: [{ key: 'vacancyMonths', label: 'Vacância prevista por ano', value: 1, unit: 'months' }] })]);
  });

  it('respeita subcategoria configurada e centro de cada lado sem inferir pela descrição', async () => {
    mocks.transactionFindMany.mockResolvedValue([
      tx('cr-1', 'rec', 'alu', 1200, '2026-01-01'),
      tx('cr-1', 'rec', 'outra', 9999, '2026-01-01'),
      tx('db-1', 'rec', 'alu', 8888, '2026-01-01'),
      tx('outro-centro', 'rec', 'alu', 7777, '2026-01-01'),
    ]);
    const origin = await repository.getOrigin({ ...params, propertyIds: ['p1'], metric: 'rentReceived' }, 'company');
    expect(origin.value).toBe(1200);
    expect(transactionIds(origin)).toEqual(['cr-1-rec-alu-2026-01-01']);
  });

  it('não atribui fontes de centro compartilhado mesmo selecionando somente um dos imóveis', async () => {
    mocks.propertyFindMany.mockResolvedValue([property(), property({ id: 'p2', title: 'Outro imóvel', center_id: 'cr-2', debit_center_id: 'db-1' })]);
    const origin = await repository.getOrigin({ ...params, propertyIds: ['p1'], metric: 'totalAnnualExpenses' }, 'company');
    expect(origin.value).toBe(0);
    expect(transactionIds(origin)).toEqual([]);
    expect(origin.properties[0].warnings).toContain('SHARED_COST_CENTER');
  });

  it('quando CR e DB coincidem, mantém fontes únicas mesmo com indicadores compostos', async () => {
    mocks.propertyFindMany.mockResolvedValue([property({ center_id: 'db-1' })]);
    const origin = await repository.getOrigin({ ...params, propertyIds: ['p1'], metric: 'roi' }, 'company');
    const ids = transactionIds(origin);
    expect(ids).toHaveLength(new Set(ids).size);
    expect(ids).toContain('db-1-rec-alu-2026-05-05');
    expect(mocks.transactionFindMany.mock.calls[0][0].where.center_id.in).toEqual(['db-1']);
  });

  it('reproduz a razão ponderada da carteira pelas somas do rodapé, em vez de média de percentuais', async () => {
    mocks.propertyFindMany.mockResolvedValue([
      property({ values: [{ id: 'v1', purchase_value: 100000, purchase_date: date('2020-01-01'), vacancy_months_per_year: 0 }] }),
      property({ id: 'p2', title: 'Imóvel 2', center_id: 'cr-2', debit_center_id: 'db-2', values: [{ id: 'v2', purchase_value: 900000, purchase_date: date('2020-01-01'), vacancy_months_per_year: 0 }] }),
    ]);
    mocks.transactionFindMany.mockResolvedValue([
      tx('cr-1', 'rec', 'alu', 12000, '2026-01-01'), tx('cr-2', 'rec', 'alu', 18000, '2026-01-01'),
    ]);
    const selection = { ...params, propertyIds: ['p1', 'p2'] };
    const roi = await repository.getOrigin({ ...selection, metric: 'roi' }, 'company');
    const cap = await repository.getOrigin({ ...selection, metric: 'capRate' }, 'company');
    const payback = await repository.getOrigin({ ...selection, metric: 'paybackYears' }, 'company');
    expect(roi.value).toBe(0.03);
    expect(cap.value).toBe(0.03);
    expect(payback.value).toBeCloseTo(1000000 / 30000);
    expect(roi.value).not.toBe((0.12 + 0.02) / 2);
    expect(roi.properties).toHaveLength(2);
    expect(roi.formula).toContain('somas dos imóveis');
    expect((await repository.getOrigin({ ...selection, metric: 'totalInvestment' }, 'company')).value).toBe(1000000);
  });

  it('preserva a precisão dos intermediários usados pela fórmula original', async () => {
    mocks.propertyFindMany.mockResolvedValue([property({ leases: [{ id: 'l1', contract_number: '3 meses', start_date: date('2025-01-01'), end_date: date('2025-04-01'), canceled_at: null }] })]);
    mocks.transactionFindMany.mockResolvedValue([tx('cr-1', 'rec', 'alu', 1, '2026-01-01')]);
    const origin = await repository.getOrigin({ ...params, propertyIds: ['p1'], metric: 'grossAnnualRevenue' }, 'company');
    expect(origin.value).toBe(4);
    expect(origin.properties[0].components[0].value).toBe(1 / 3);
    expect(origin.properties[0].components[0].value! * 12).toBe(origin.value);
  });

  it('protege escopo da empresa nas consultas e não retorna metadados de relações de outra empresa', async () => {
    mocks.transactionFindMany.mockResolvedValue([{
      ...tx('db-1', 'imp', 'iptu', 1200, '2026-01-01'),
      center: { id: 'foreign-center', name: 'Segredo de outra empresa', company_id: 'other-company' },
      financial_institution: { id: 'foreign-bank', name: 'Segredo de outra empresa', company_id: 'other-company' },
    }]);
    const origin = await repository.getOrigin({ ...params, propertyIds: ['p1'], metric: 'iptuAnnual' }, 'company');
    expect(mocks.propertyFindMany.mock.calls[0][0]).toMatchObject({ where: { company_id: 'company', deleted_at: null }, select: { leases: { where: { company_id: 'company', deleted_at: null } } } });
    expect(mocks.categoryFindMany.mock.calls[0][0]).toMatchObject({ where: { company_id: 'company', deleted_at: null }, select: { subcategories: { where: { company_id: 'company', deleted_at: null } } } });
    expect(mocks.transactionFindMany.mock.calls[0][0].where.company_id).toBe('company');
    expect(origin.properties[0].sources[0]).toMatchObject({ kind: 'transaction', center: null, institution: null });
    expect(JSON.stringify(origin)).not.toContain('Segredo');
  });

  it('recusa ID ausente/fora da empresa sem consultar lançamentos', async () => {
    await expect(repository.getOrigin({ ...params, propertyIds: ['p1', 'other-company-property'], metric: 'roi' }, 'company')).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.transactionFindMany).not.toHaveBeenCalled();
  });

  it('oferece origem para cada métrica numérica e mantém valor idêntico ao relatório', async () => {
    const [row] = (await repository.getReport(params, 'company')).rows;
    for (const metric of ROI_METRIC_KEYS) {
      const origin = await repository.getOrigin({ ...params, propertyIds: ['p1'], metric }, 'company');
      expect(origin.value, metric).toBe(row[metric]);
      expect(origin.properties[0].value, metric).toBe(row[metric]);
    }
  });
});

it('não trata condomínio mensal gerado pela locação como aluguel no ROI, mesmo com a categoria compartilhada', async () => {
  mocks.categoryFindMany.mockResolvedValue(categories); mocks.settingsFindUnique.mockResolvedValue(null); mocks.propertyFindMany.mockResolvedValue([property()]);
  mocks.transactionFindMany.mockResolvedValue([...spreadsheetTransactions,{...tx('cr-1','rec','alu',150,'2026-05-05'),lease_id:'lease-1',installment_number:1,description:'Condomínio 1/12 - Contrato 4169/23'}]);
  const report=await new PrismaPropertyRoiRepository().getReport(params,'company');
  expect(report.rows[0].rentReceived).toBe(26400);
});
