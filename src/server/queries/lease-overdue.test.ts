import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transactionFindMany: vi.fn(),
  notificationFindMany: vi.fn(),
  holidayFindMany: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/infra/database/prisma', () => ({
  default: {
    transaction: { findMany: mocks.transactionFindMany },
    leaseNotification: { findMany: mocks.notificationFindMany },
    holiday: { findMany: mocks.holidayFindMany },
  },
}));
vi.mock('@/infra/auth/session', () => ({ withPermission: vi.fn() }));

import { findOverdueLeasesForCompany } from './lease-overdue';

describe('consulta de alertas de locações', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transactionFindMany.mockResolvedValue([]);
  });

  it('considera somente contratos vigentes na data da consulta', async () => {
    await findOverdueLeasesForCompany('company-1');

    expect(mocks.transactionFindMany).toHaveBeenCalledOnce();
    const query = mocks.transactionFindMany.mock.calls[0][0];
    const leaseWhere = query.where.lease.is;

    expect(leaseWhere).toMatchObject({
      company_id: 'company-1',
      deleted_at: null,
      status: { not: 'CANCELED' },
      start_date: { lte: expect.any(Date) },
      end_date: { gte: expect.any(Date) },
    });
    expect(leaseWhere.start_date.lte).toEqual(leaseWhere.end_date.gte);
  });
});
