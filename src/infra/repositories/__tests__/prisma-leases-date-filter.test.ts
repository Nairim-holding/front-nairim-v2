import { describe, expect, it, vi } from 'vitest';

vi.mock('@/infra/database/prisma', () => ({ default: {} }));

import { buildDateCondition } from '@/infra/repositories/prisma-leases-repository';

const iso = (date: Date | undefined) => date?.toISOString();

describe('filtros de data das locações', () => {
  it('preserva as duas bordas do intervalo sem deslocamento de fuso', () => {
    const condition = buildDateCondition({ from: '2026-01-01', to: '2026-12-31' });
    expect(iso(condition.gte)).toBe('2026-01-01T00:00:00.000Z');
    expect(iso(condition.lte)).toBe('2026-12-31T00:00:00.000Z');
  });

  it('aceita somente a data inicial ou somente a data final', () => {
    expect(iso(buildDateCondition({ from: '2026-03-10' }).gte)).toBe('2026-03-10T00:00:00.000Z');
    expect(iso(buildDateCondition({ to: '2026-04-20' }).lte)).toBe('2026-04-20T00:00:00.000Z');
  });

  it('trata uma data simples como dia exato', () => {
    expect(iso(buildDateCondition('2026-09-06').equals)).toBe('2026-09-06T00:00:00.000Z');
  });
});
