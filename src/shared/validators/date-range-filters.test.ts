import { describe, expect, it } from 'vitest';
import { planningDashboardQuerySchema } from './planning';
import { investmentDashboardQuerySchema } from './investment';
import { iptuAuditQuerySchema } from './iptu-audit';
import { reportParamsSchema } from './financial-report';
import { dashboardParamsSchema } from './dashboard';
import { expenseByCategoryQuerySchema } from './financial-reports';
import { cardUsageSummarySchema } from './financial-card';

describe('validação dos períodos dos filtros', () => {
  it('aceita períodos válidos', () => {
    expect(planningDashboardQuerySchema.safeParse({ startDate: '2026-01-01', endDate: '2026-12-31' }).success).toBe(true);
    expect(investmentDashboardQuerySchema.safeParse({ startMonth: '2026-01', endMonth: '2026-12' }).success).toBe(true);
    expect(iptuAuditQuerySchema.safeParse({ startDate: '2026-01-01', endDate: '2026-12-31' }).success).toBe(true);
    expect(dashboardParamsSchema.safeParse({ startDate: '2026-01-01', endDate: '2026-12-31' }).success).toBe(true);
  });

  it('rejeita períodos invertidos', () => {
    expect(planningDashboardQuerySchema.safeParse({ startDate: '2026-12-31', endDate: '2026-01-01' }).success).toBe(false);
    expect(investmentDashboardQuerySchema.safeParse({ startMonth: '2026-12', endMonth: '2026-01' }).success).toBe(false);
    expect(iptuAuditQuerySchema.safeParse({ startDate: '2026-12-31', endDate: '2026-01-01' }).success).toBe(false);
    expect(expenseByCategoryQuerySchema.safeParse({ startDate: '2026-12-31', endDate: '2026-01-01' }).success).toBe(false);
    expect(cardUsageSummarySchema.safeParse({ startDate: '2026-12-31', endDate: '2026-01-01' }).success).toBe(false);
  });

  it('rejeita dias inexistentes', () => {
    expect(planningDashboardQuerySchema.safeParse({ startDate: '2026-02-31', endDate: '2026-03-01' }).success).toBe(false);
    expect(reportParamsSchema.safeParse({ startDate: '2026-02-31', endDate: '2026-03-01' }).success).toBe(false);
    expect(dashboardParamsSchema.safeParse({ startDate: '2026-02-31', endDate: '2026-03-01' }).success).toBe(false);
  });
});
