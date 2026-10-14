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

  it('inclui contratos encerrados e deixa de fora os cancelados', async () => {
    await findOverdueLeasesForCompany('company-1');

    expect(mocks.transactionFindMany).toHaveBeenCalledOnce();
    const query = mocks.transactionFindMany.mock.calls[0][0];
    const leaseWhere = query.where.lease.is;

    expect(leaseWhere).toMatchObject({
      company_id: 'company-1',
      deleted_at: null,
      status: { not: 'CANCELED' },
      start_date: { lte: expect.any(Date) },
    });
    expect(leaseWhere).not.toHaveProperty('end_date');
  });

  it('sinaliza a pendência de contrato já encerrado', async () => {
    const lease = (id: string, end_date: Date) => ({
      id, contract_number: id, end_date, rent_due_day: 10, overdue_status: null,
      property: { title: 'Rua Minas Gerais, 101', addresses: [] },
      tenant: { name: 'Locatário' }, agency: null,
    });
    mocks.transactionFindMany.mockResolvedValue([
      { id: 'tx-ended', amount: 1100, effective_date: new Date('2024-09-10T00:00:00.000Z'), lease: lease('4169/23', new Date('2024-11-10T00:00:00.000Z')) },
      { id: 'tx-current', amount: 900, effective_date: new Date('2024-10-10T00:00:00.000Z'), lease: lease('5000/24', new Date('2099-12-31T00:00:00.000Z')) },
    ]);
    mocks.notificationFindMany.mockResolvedValue([]);
    mocks.holidayFindMany.mockResolvedValue([]);

    const result = await findOverdueLeasesForCompany('company-1');

    expect(result.map((item) => [item.transaction_id, item.contract_ended])).toEqual([
      ['tx-ended', true],
      ['tx-current', false],
    ]);
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
