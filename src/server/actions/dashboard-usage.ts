'use server';

import { type ActionResult, runAction } from '@/shared/actions/action-result';
import {
  getDatabaseUsageData,
  getStorageUsageData,
  getTenantTenureDistributionData,
} from '@/server/queries/dashboard-usage';
import type {
  DatabaseUsageResult,
  StorageUsageResult,
  TenantTenureDistribution,
} from '@/core/entities/dashboard-usage';

/**
 * Server Actions dos widgets de infra do Dashboard.
 * Substituem as chamadas de `authFetch` a `/dashboard/storage`,
 * `/dashboard/database` e `/dashboard/tenant-tenure` — sem fetch nem token:
 * a guarda (`withTenant`) roda no servidor.
 * Camada: server. Origem: DashboardController.
 */

export async function getTenantTenureDistributionAction(
  startDate?: string | null,
  endDate?: string | null,
  companyIds?: string[],
): Promise<ActionResult<TenantTenureDistribution>> {
  return runAction(() =>
    getTenantTenureDistributionData(
      new Date(startDate ?? ''),
      new Date(endDate ?? ''),
      { company_ids: companyIds },
    ),
  );
}

export async function getDatabaseUsageAction(raw: Record<string, unknown> = {}): Promise<ActionResult<DatabaseUsageResult>> {
  return runAction(() => getDatabaseUsageData(raw));
}

export async function getStorageUsageAction(raw: Record<string, unknown> = {}): Promise<ActionResult<StorageUsageResult>> {
  return runAction(() => getStorageUsageData(raw));
}
