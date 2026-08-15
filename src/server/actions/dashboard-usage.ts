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
): Promise<ActionResult<TenantTenureDistribution>> {
  return runAction(() =>
    getTenantTenureDistributionData(
      new Date(startDate ?? ''),
      new Date(endDate ?? ''),
    ),
  );
}

export async function getDatabaseUsageAction(): Promise<ActionResult<DatabaseUsageResult>> {
  return runAction(() => getDatabaseUsageData());
}

export async function getStorageUsageAction(): Promise<ActionResult<StorageUsageResult>> {
  return runAction(() => getStorageUsageData());
}