import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transactionFindMany: vi.fn(),
  notificationFindMany: vi.fn(),
  holidayFindMany: vi.fn(),
  leaseFindMany: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/infra/database/prisma', () => ({
  default: {
    transaction: { findMany: mocks.transactionFindMany },
    leaseNotification: { findMany: mocks.notificationFindMany },
    holiday: { findMany: mocks.holidayFindMany },
    lease: { findMany: mocks.leaseFindMany },
  },
}));
vi.mock('@/infra/auth/session', () => ({ withPermission: vi.fn() }));

import { findOverdueLeasesForCompany, resolveAgencyAlertContact } from './lease-overdue';

describe('consulta de alertas de locações', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transactionFindMany.mockResolvedValue([]);
    mocks.leaseFindMany.mockResolvedValue([]);
    mocks.notificationFindMany.mockResolvedValue([]);
    mocks.holidayFindMany.mockResolvedValue([]);
  });

  it('inclui contratos encerrados sem limitar o período dos atrasos antigos', async () => {
    await findOverdueLeasesForCompany('company-1');

    expect(mocks.transactionFindMany).toHaveBeenCalledOnce();
    const query = mocks.transactionFindMany.mock.calls[0][0];
    const leaseWhere = query.where.OR[1].lease.is;

    expect(leaseWhere).toMatchObject({
      company_id: 'company-1',
      deleted_at: null,
      start_date: { lte: expect.any(Date) },
    });
    expect(leaseWhere).not.toHaveProperty('end_date');
    expect(query.where).toMatchObject({ status: 'PENDING', deleted_at: null, canceled_at: null, is_transfer: false });
  });

  it('sinaliza a pendência de contrato já encerrado', async () => {
    const lease = (id: string, end_date: Date) => ({
      id, contract_number: id, end_date, start_date: new Date('2023-01-01'), canceled_at: null, status: 'EXPIRED', rent_due_day: 10, overdue_status: null,
      property: { title: 'Rua Minas Gerais, 101', addresses: [] },
      tenant: { name: 'Locatário' }, agency: null,
    });
    mocks.transactionFindMany.mockResolvedValue([
      { id: 'tx-ended', lease_id: '4169/23', description: 'Recebimento aluguel', category: { type: 'INCOME' }, amount: 1100, event_date: new Date('2024-09-01'), effective_date: new Date('2024-09-10T00:00:00.000Z'), lease: lease('4169/23', new Date('2024-11-10T00:00:00.000Z')) },
      { id: 'tx-current', lease_id: '5000/24', description: 'Aluguel', category: { type: 'INCOME' }, amount: 900, event_date: new Date('2024-10-01'), effective_date: new Date('2024-10-10T00:00:00.000Z'), lease: lease('5000/24', new Date('2099-12-31T00:00:00.000Z')) },
    ]);
    mocks.notificationFindMany.mockResolvedValue([]);
    mocks.holidayFindMany.mockResolvedValue([]);

    const result = await findOverdueLeasesForCompany('company-1');

    expect(result.map((item) => [item.transaction_id, item.contract_ended])).toEqual([
      ['tx-ended', true],
      ['tx-current', false],
    ]);
  });

  it('reconhece legado sem vínculo e mantém setembro e outubro de 4169/23 separados', async () => {
    const legacyLease = {
      id: 'old-lease', contract_number: '4169/23', start_date: new Date('2023-01-01'), end_date: new Date('2024-12-31'),
      canceled_at: null, status: 'EXPIRED', rent_due_day: 10, overdue_status: null,
      property: { title: 'Minas Gerais 101', addresses: [] }, tenant: { name: 'Locatário' }, agency: null,
    };
    mocks.leaseFindMany.mockResolvedValue([legacyLease]);
    mocks.transactionFindMany.mockResolvedValue([9, 10].map((month) => ({
      id: `tx-${month}`, lease_id: null, lease: null, description: 'Recebimento aluguel - Contrato 4169/23',
      amount: 1100, event_date: new Date(Date.UTC(2024, month - 1, 1)), effective_date: new Date(Date.UTC(2024, month - 1, 10)), category: { type: 'INCOME' },
    })));
    const result = await findOverdueLeasesForCompany('company-1');
    expect(result.map((item) => [item.lease_id, item.reference_month, item.reference_year])).toEqual([
      ['old-lease', 9, 2024], ['old-lease', 10, 2024],
    ]);
  });

  it('mantém dívida anterior ao cancelamento, exclui parcelas posteriores e não adivinha contrato ambíguo', async () => {
    const lease = {
      id: 'canceled', contract_number: '4169/23', start_date: new Date('2023-01-01'), end_date: new Date('2024-12-31'),
      canceled_at: new Date('2024-10-01'), status: 'CANCELED', rent_due_day: 10, overdue_status: null,
      property: { title: 'Minas Gerais 101', addresses: [] }, tenant: { name: 'Locatário' }, agency: null,
    };
    mocks.leaseFindMany.mockResolvedValue([lease, { ...lease, id: 'ambiguous' }]);
    mocks.transactionFindMany.mockResolvedValue([
      { id: 'old', lease_id: lease.id, lease, description: 'Aluguel', category: { type: 'INCOME' }, amount: 1100, event_date: new Date('2024-09-01'), effective_date: new Date('2024-09-10') },
      { id: 'future', lease_id: lease.id, lease, description: 'Aluguel', category: { type: 'INCOME' }, amount: 1100, event_date: new Date('2024-10-01'), effective_date: new Date('2024-10-10') },
      { id: 'loose', lease_id: null, lease: null, description: 'Aluguel Contrato 4169/23', category: { type: 'INCOME' }, amount: 1100, event_date: new Date('2024-09-01'), effective_date: new Date('2024-09-10') },
    ]);
    const result = await findOverdueLeasesForCompany('company-1');
    expect(result.map((item) => [item.transaction_id, item.contract_canceled])).toEqual([['old', true]]);
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
