import type { MetricResult, PeriodComparison } from '@/core/entities/dashboard';

/**
 * Helpers puros de cálculo das métricas do Dashboard.
 * Porte fiel de api-nairim-v2/src/services/DashboardService.ts
 * (`decimalToNumber`, `calcVariation`, `getPeriodDates`, `calculateVacancyMonths`).
 * Camada: core — sem dependência de Prisma/HTTP, testável isoladamente.
 */

export function decimalToNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : Number(value);
}

export function calcVariation(
  current: number,
  previous: number,
  data: unknown[] = [],
): MetricResult {
  if (previous === 0 || !Number.isFinite(previous)) {
    return {
      result: Number(current.toFixed(2)),
      variation: 0,
      isPositive: current >= 0,
      data,
    };
  }
  let variation = ((current - previous) / previous) * 100;
  variation = Math.max(Math.min(variation, 100), -100);

  return {
    result: Number(current.toFixed(2)),
    variation: Number(variation.toFixed(2)),
    isPositive: variation >= 0,
    data,
  };
}

export function getPeriodDatesIn(startDate: Date, endDate: Date): PeriodComparison {
  const diffMs = endDate.getTime() - startDate.getTime();
  return {
    current: { start: startDate, end: endDate },
    previous: {
      start: new Date(startDate.getTime() - diffMs - 1),
      end: new Date(startDate.getTime() - 1),
    },
  };
}

export function calculateVacancyMonths(
  leases: { end_date: Date }[] | undefined | null,
  referenceDate: Date,
): number {
  if (!leases || leases.length === 0) return 12;

  const lastLease = leases[0];
  const leaseEnd = new Date(lastLease.end_date);

  if (leaseEnd >= referenceDate) return 0;

  const monthsDiff = (referenceDate.getFullYear() - leaseEnd.getFullYear()) * 12;
  return Math.max(0, monthsDiff + (referenceDate.getMonth() - leaseEnd.getMonth()));
}