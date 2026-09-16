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

import { findOverdueLeasesForCompany, resolveAgencyAlertContact } from './lease-overdue';

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

  it('usa somente o telefone escolhido para os alertas da imobiliária', () => {
    expect(resolveAgencyAlertContact([
      {
        email: 'financeiro@imobiliaria.com.br',
        cellphone: '14911111111',
        phone: null,
        whatsapp_notification_phone: null,
        channels: [],
      },
      {
        email: null,
        cellphone: '14922222222',
        phone: null,
        whatsapp_notification_phone: '14922222222',
        channels: [],
      },
    ])).toEqual({
      email: 'financeiro@imobiliaria.com.br',
      phone: '14922222222',
    });
  });

  it('não usa outro telefone quando nenhum número foi selecionado', () => {
    expect(resolveAgencyAlertContact([{
      email: null,
      cellphone: '14911111111',
      phone: '1433333333',
      whatsapp_notification_phone: null,
      channels: [{ kind: 'CELLPHONE', value: '14922222222' }],
    }])).toEqual({ email: null, phone: null });
  });
});
