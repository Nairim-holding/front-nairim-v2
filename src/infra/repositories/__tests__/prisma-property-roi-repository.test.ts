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
  values: [{ purchase_value: 350000, purchase_date: date('2020-01-10'), vacancy_months_per_year: 1 }],
  leases: [{ start_date: date('2024-10-13'), end_date: date('2025-10-13'), canceled_at: null }],
  ...overrides,
});

const tx = (center_id: string, category_id: string, subcategory_id: string, amount: number, when: string) => ({
  center_id, category_id, subcategory_id, amount, effective_date: date(when),
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
});
