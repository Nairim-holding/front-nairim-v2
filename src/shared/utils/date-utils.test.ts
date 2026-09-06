import { describe, expect, it } from 'vitest';
import { buildDateOnlyCondition, buildDateTimeCondition } from './date-utils';

const iso = (value: Date | undefined) => value?.toISOString();

describe('condições compartilhadas de data', () => {
  it('mantém datas SQL DATE na meia-noite UTC', () => {
    const condition = buildDateOnlyCondition({ from: '2026-01-01', to: '2026-12-31' });
    expect(iso(condition.gte)).toBe('2026-01-01T00:00:00.000Z');
    expect(iso(condition.lte)).toBe('2026-12-31T00:00:00.000Z');
  });

  it('inclui o último dia inteiro para colunas DateTime', () => {
    const condition = buildDateTimeCondition({ from: '2026-01-01', to: '2026-12-31' });
    expect(iso(condition.gte)).toBe('2026-01-01T00:00:00.000Z');
    expect(iso(condition.lte)).toBe('2026-12-31T23:59:59.999Z');
  });

  it('aceita apenas uma das bordas do intervalo', () => {
    expect(iso(buildDateTimeCondition({ from: '2026-03-10' }).gte)).toBe('2026-03-10T00:00:00.000Z');
    expect(iso(buildDateTimeCondition({ to: '2026-04-20' }).lte)).toBe('2026-04-20T23:59:59.999Z');
  });
});
