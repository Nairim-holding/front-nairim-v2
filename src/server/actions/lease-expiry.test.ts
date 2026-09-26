import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ lease: { findMany: vi.fn() }, leaseExpiryReminder: {
  upsert: vi.fn(), updateMany: vi.fn(), findFirstOrThrow: vi.fn(), update: vi.fn(),
} }));
vi.mock('@/infra/database/prisma', () => ({ default: db }));
vi.mock('@/infra/auth/session', () => ({ withPermission: async (_resource: string, _action: string, fn: (session: object) => unknown) => fn({ id: 'user', company_id: 'company' }) }));
import { acknowledgeLeaseExpiryAction, getLeaseExpiryAlertsAction } from './lease-expiry';

const lease = { id: 'lease', end_date: new Date('2026-10-26T00:00:00Z'), property: { title: 'Casa' }, tenant: { name: 'Ana' }, expiry_reminders: [] as object[] };
const reminder = { id: 'reminder', end_date: lease.end_date, shown_days: ['2026-09-24', '2026-09-25', '2026-09-26'], acknowledged_on: null, dismissed: false };

describe('expiry notification actions', () => {
  afterEach(() => vi.useRealTimers());
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-26T12:00:00Z'));
    db.lease.findMany.mockResolvedValue([lease]);
    db.leaseExpiryReminder.upsert.mockResolvedValue(reminder);
    db.leaseExpiryReminder.findFirstOrThrow.mockResolvedValue(reminder);
  });
  it('polls without counting a display, then records only visible eligible alerts', async () => {
    const result = await getLeaseExpiryAlertsAction();
    expect(result).toMatchObject({ ok: true, data: [{ daysRemaining: 30, canDismiss: false }] });
    expect(db.leaseExpiryReminder.upsert).not.toHaveBeenCalled();
    await getLeaseExpiryAlertsAction(['foreign-lease']);
    expect(db.leaseExpiryReminder.upsert).not.toHaveBeenCalled();
    expect(await getLeaseExpiryAlertsAction(['lease'])).toMatchObject({ ok: true, data: [{ canDismiss: true }] });
    expect(db.lease.findMany.mock.calls[0][0].where).toMatchObject({ company_id: 'company', status: { not: 'CANCELED' }, end_date: { gte: new Date('2026-09-26'), lte: new Date('2026-10-26') } });
    expect(db.leaseExpiryReminder.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ user_id: 'user', NOT: { shown_days: { has: '2026-09-26' } } }) }));
  });
  it('hides an acknowledged notice only for that day and a dismissed notice until renewal', async () => {
    db.lease.findMany.mockResolvedValue([{ ...lease, expiry_reminders: [{ ...reminder, acknowledged_on: '2026-09-26' }] }]);
    expect(await getLeaseExpiryAlertsAction()).toMatchObject({ ok: true, data: [] });
    vi.setSystemTime(new Date('2026-09-27T12:00:00Z'));
    expect(await getLeaseExpiryAlertsAction()).toMatchObject({ ok: true, data: [{ daysRemaining: 29 }] });
    db.lease.findMany.mockResolvedValue([{ ...lease, expiry_reminders: [{ ...reminder, dismissed: true }] }]);
    expect(await getLeaseExpiryAlertsAction()).toMatchObject({ ok: true, data: [] });
    db.lease.findMany.mockResolvedValue([{ ...lease, end_date: new Date('2026-10-27'), expiry_reminders: [{ ...reminder, dismissed: true }] }]);
    expect(await getLeaseExpiryAlertsAction()).toMatchObject({ ok: true, data: [{ daysRemaining: 30 }] });
  });
  it('enforces the three-day rule server-side and scopes acknowledgement to user and company', async () => {
    db.lease.findMany.mockResolvedValue([{ ...lease, expiry_reminders: [{ ...reminder, shown_days: ['2026-09-26'] }] }]);
    expect(await acknowledgeLeaseExpiryAction('lease', '2026-10-26', true)).toMatchObject({ ok: false, status: 400 });
    expect(db.leaseExpiryReminder.update).not.toHaveBeenCalled();
    expect(await acknowledgeLeaseExpiryAction('foreign-lease', '2026-10-26')).toMatchObject({ ok: false, status: 400 });
    expect(await acknowledgeLeaseExpiryAction('lease', '2026-10-26')).toMatchObject({ ok: true });
    expect(db.leaseExpiryReminder.update).toHaveBeenCalledWith({ where: { id: 'reminder', user_id: 'user', company_id: 'company' }, data: { acknowledged_on: '2026-09-26' } });
    db.lease.findMany.mockResolvedValue([{ ...lease, expiry_reminders: [reminder] }]);
    expect(await acknowledgeLeaseExpiryAction('lease', '2026-10-26', true)).toMatchObject({ ok: true });
  });
  it('keeps dismissal available after a missed day and resets eligibility for a new end date', async () => {
    vi.setSystemTime(new Date('2026-09-30T12:00:00Z'));
    const eligibleReminder = { ...reminder, shown_days: ['2026-09-26', '2026-09-27', '2026-09-28'] };
    db.lease.findMany.mockResolvedValue([{ ...lease, expiry_reminders: [eligibleReminder] }]);
    expect(await getLeaseExpiryAlertsAction()).toMatchObject({ ok: true, data: [{ canDismiss: true }] });

    db.leaseExpiryReminder.findFirstOrThrow.mockResolvedValue({ ...eligibleReminder, shown_days: [...eligibleReminder.shown_days, '2026-09-30'] });
    expect(await getLeaseExpiryAlertsAction(['lease'])).toMatchObject({ ok: true, data: [{ canDismiss: true }] });
    db.lease.findMany.mockResolvedValue([{ ...lease, expiry_reminders: [{ ...eligibleReminder, shown_days: [...eligibleReminder.shown_days, '2026-09-30'] }] }]);
    expect(await acknowledgeLeaseExpiryAction('lease', '2026-10-26', true)).toMatchObject({ ok: true });
    expect(db.leaseExpiryReminder.update).toHaveBeenCalledWith({ where: { id: 'reminder', user_id: 'user', company_id: 'company' }, data: { dismissed: true } });

    db.lease.findMany.mockResolvedValue([{ ...lease, end_date: new Date('2026-10-27'), expiry_reminders: [eligibleReminder] }]);
    expect(await getLeaseExpiryAlertsAction()).toMatchObject({ ok: true, data: [{ canDismiss: false }] });
  });
});
