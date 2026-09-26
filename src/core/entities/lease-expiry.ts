import { occupancyDate } from '@/shared/utils/property-occupancy';

export interface LeaseExpiryAlert {
  leaseId: string;
  propertyTitle: string;
  tenantName: string;
  endDate: string;
  daysRemaining: number;
  canDismiss: boolean;
}

export function expiryDays(endDate: Date | string, now = new Date()): number {
  return Math.round((new Date(endDate).getTime() - occupancyDate(now).getTime()) / 86_400_000);
}

/** Eligibility depends on actual daily displays, not elapsed time or polling. */
export function canDismissExpiry(shownDays: readonly string[], today: string): boolean {
  const days = new Set(shownDays);
  const date = new Date(`${today}T00:00:00Z`);
  for (let offset = 0; offset < 3; offset++) {
    if (!days.has(date.toISOString().slice(0, 10))) return false;
    date.setUTCDate(date.getUTCDate() - 1);
  }
  return true;
}
