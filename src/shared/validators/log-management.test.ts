import { describe, expect, it } from 'vitest';
import { buildLogSelection, logSelectionSchema } from './log-management';

describe('log selection safety', () => {
  it('rejects missing, reversed and impossible date ranges', () => {
    for (const range of [{}, { from: '2026-10-02', to: '2026-10-01' }, { from: '2026-02-30', to: '2026-03-01' }]) {
      expect(logSelectionSchema.safeParse({ mode: 'range', ...range }).success).toBe(false);
    }
  });
  it('never accepts a tenant or a MongoDB operator from the caller', () => {
    expect(buildLogSelection('tenant-a', { mode: 'all', company_id: 'tenant-b', $or: [{}] })).toMatchObject({ company_id: 'tenant-a' });
    expect(() => buildLogSelection('', { mode: 'all' })).toThrow();
    expect(() => buildLogSelection('a', { mode: 'all', user_email: { $ne: null } })).toThrow();
  });
  it('uses a fixed cutoff, preserves recent records and rejects zero days', () => {
    const now = new Date('2026-09-11T12:00:00Z');
    expect(buildLogSelection('a', { mode: 'older', days: 30 }, now)).toEqual({
      company_id: 'a', ingested_at: { $lte: now }, created_at: { $lt: new Date('2026-08-12T12:00:00Z') },
    });
    expect(() => buildLogSelection('a', { mode: 'older', days: 0 })).toThrow();
  });
  it('includes the entire selected day in Brasília and combines optional filters', () => {
    expect(buildLogSelection('a', { mode: 'range', from: '2026-09-01', to: '2026-09-01', action: 'DELETE', user_email: 'a@example.com' })).toMatchObject({
      created_at: { $gte: new Date('2026-09-01T03:00:00Z'), $lt: new Date('2026-09-02T03:00:00Z') },
      action: 'DELETE', user_email: 'a@example.com',
    });
  });
});
