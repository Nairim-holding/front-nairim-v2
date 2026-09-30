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

/** Three consecutive display days permanently unlock dismissal for this expiry. */
export function canDismissExpiry(shownDays: readonly string[], today: string): boolean {
  const days = [...new Set(shownDays)].filter(day => day <= today).sort();
  let previousDay = Number.NaN;
  let streak = 0;
  for (const day of days) {
    const timestamp = new Date(`${day}T00:00:00Z`).getTime();
    streak = timestamp - previousDay === 86_400_000 ? streak + 1 : 1;
    if (streak >= 3) return true;
    previousDay = timestamp;
  }
  return false;
}
