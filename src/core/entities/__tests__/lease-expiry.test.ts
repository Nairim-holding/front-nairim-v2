import { describe, expect, it } from 'vitest';
import { canDismissExpiry, expiryDays } from '../lease-expiry';

describe('lease expiry reminders', () => {
  it('counts calendar days in São Paulo across UTC midnight and month boundaries', () => {
    expect(expiryDays('2026-10-26', new Date('2026-09-27T01:00:00Z'))).toBe(30);
    expect(expiryDays('2026-10-26', new Date('2026-09-27T03:00:00Z'))).toBe(29);
    expect(expiryDays('2026-10-26', new Date('2026-10-26T12:00:00Z'))).toBe(0);
  });
  it('requires three consecutive distinct display days', () => {
    expect(canDismissExpiry(['2026-09-30', '2026-10-01', '2026-10-02'], '2026-10-02')).toBe(true);
    expect(canDismissExpiry(['2026-09-29', '2026-10-01', '2026-10-02'], '2026-10-02')).toBe(false);
    expect(canDismissExpiry(['2026-10-02', '2026-10-02', '2026-10-02'], '2026-10-02')).toBe(false);
    expect(canDismissExpiry([], '2026-10-02')).toBe(false);
  });
  it('keeps dismissal available after a completed streak even when later days are skipped', () => {
    expect(canDismissExpiry(['2026-09-30', '2026-10-01', '2026-10-02'], '2026-10-04')).toBe(true);
    expect(canDismissExpiry(['2026-10-04', '2026-10-02', '2026-09-30', '2026-10-01', '2026-10-01'], '2026-10-04')).toBe(true);
    expect(canDismissExpiry(['2026-12-30', '2026-12-31', '2027-01-01'], '2027-01-03')).toBe(true);
  });
  it('does not unlock dismissal using future display days', () => {
    expect(canDismissExpiry(['2026-09-30', '2026-10-01', '2026-10-02'], '2026-10-01')).toBe(false);
  });
});
