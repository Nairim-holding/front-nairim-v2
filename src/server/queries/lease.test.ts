import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/infra/factories/lease-factory', () => ({ leaseUseCases: {} }));
vi.mock('@/infra/auth/session', () => ({ withTenant: vi.fn() }));

import { splitListParams } from './lease';

describe('parâmetros da listagem de locações', () => {
  it('mantém os intervalos de data recebidos da tela', () => {
    const startRange = { from: '2026-01-01', to: '2026-06-30' };
    const endRange = { from: '2026-07-01', to: '2026-12-31' };

    expect(splitListParams({
      page: 1,
      limit: 50,
      start_date: startRange,
      end_date: endRange,
    }).filters).toEqual({
      start_date: startRange,
      end_date: endRange,
    });
  });

  it('continua aceitando intervalos serializados e filtros com vários valores', () => {
    expect(splitListParams({
      'filter[start_date]': JSON.stringify({ from: '2026-01-01', to: '2026-01-31' }),
      status: ['ACTIVE', 'EXPIRING'],
    }).filters).toEqual({
      start_date: { from: '2026-01-01', to: '2026-01-31' },
      status: ['ACTIVE', 'EXPIRING'],
    });
  });
});
