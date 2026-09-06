import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/infra/factories/investment-factory', () => ({ investmentUseCases: {} }));
vi.mock('@/infra/auth/session', () => ({ withTenant: vi.fn() }));

import { normalizeInvestmentFilterValues } from './investment';

describe('filtros de investimentos', () => {
  it('preserva intervalos de data no formato entendido pelo repositório', () => {
    expect(normalizeInvestmentFilterValues({ from: '2026-01-01', to: '2026-12-31' }))
      .toEqual(['{"from":"2026-01-01","to":"2026-12-31"}']);
  });

  it('preserva seleções múltiplas', () => {
    expect(normalizeInvestmentFilterValues(['CDB', 'LCI'])).toEqual(['CDB', 'LCI']);
  });
});
