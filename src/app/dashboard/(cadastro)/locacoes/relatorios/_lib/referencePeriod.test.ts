import { describe, expect, it } from 'vitest';
import { currentReferenceMonth } from './referencePeriod';

describe('currentReferenceMonth', () => {
  it('retorna o mês atual usando o calendário local', () => {
    expect(currentReferenceMonth(new Date(2026, 8, 6))).toEqual({ year: 2026, month: 9 });
  });
});
