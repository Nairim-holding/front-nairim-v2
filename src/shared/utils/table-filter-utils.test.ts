import { describe, expect, it } from 'vitest';
import { matchesTableFilter, serializeTableFilters } from './table-filter-utils';

describe('filtros de tabela', () => {
  it('serializa intervalos e seleções múltiplas para as server actions', () => {
    expect(serializeTableFilters({
      created_at: { from: '2026-01-01', to: '2026-01-31' },
      status: ['ACTIVE', 'EXPIRED'],
      name: 'Maria',
    })).toEqual({
      created_at: '{"from":"2026-01-01","to":"2026-01-31"}',
      status: '["ACTIVE","EXPIRED"]',
      name: 'Maria',
    });
  });

  it('compara intervalos de data no modo local', () => {
    const range = { from: '2026-02-01', to: '2026-02-28' };
    expect(matchesTableFilter('2026-02-28', range)).toBe(true);
    expect(matchesTableFilter('2026-03-01', range)).toBe(false);
  });

  it('compara intervalos numéricos e seleções múltiplas no modo local', () => {
    expect(matchesTableFilter(150, { min: 100, max: 200 })).toBe(true);
    expect(matchesTableFilter(250, { min: 100, max: 200 })).toBe(false);
    expect(matchesTableFilter('ACTIVE', ['ACTIVE', 'EXPIRED'])).toBe(true);
  });
});
