'use server';

import { type ActionResult, runAction } from '@/shared/actions/action-result';
import { getDashboardSectionData } from '@/server/queries/dashboard';
import type {
  ClientsMetrics,
  DashboardSection,
  FinancialMetrics,
  GeolocationResponse,
  PortfolioMetrics,
} from '@/core/entities/dashboard';

/**
 * Server Action do módulo Dashboard (para Client Components).
 * Substitui as chamadas de `fetchSection` via HTTP em
 * DashboardClient — sem `fetch` nem token: a guarda roda no servidor.
 * Camada: server. Origem: DashboardController.
 */

export async function getDashboardSectionAction(
  section: DashboardSection,
  startDate?: string | null,
  endDate?: string | null,
): Promise<
  ActionResult<FinancialMetrics | PortfolioMetrics | ClientsMetrics | GeolocationResponse>
> {
  return runAction(() =>
    getDashboardSectionData(section, {
      startDate: startDate ?? '',
      endDate: endDate ?? '',
    }),
  );
}