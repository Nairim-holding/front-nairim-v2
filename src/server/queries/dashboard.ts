import 'server-only';
import { dashboardUseCases } from '@/infra/factories/dashboard-factory';
import { withTenant } from '@/infra/auth/session';
import { dashboardParamsSchema } from '@/shared/validators/dashboard';
import { ValidationError } from '@/core/errors/domain-errors';
import type {
  ClientsMetrics,
  DashboardSection,
  FinancialMetrics,
  GeolocationResponse,
  PortfolioMetrics,
} from '@/core/entities/dashboard';

/**
 * Queries (leitura) das métricas do Dashboard.
 * Guarda: `withTenant`. Camada: server.
 * Origem: DashboardController (GET /dashboard/financial|portfolio|clients|map).
 */

function parseAndValidate(raw: Record<string, unknown>): { startDate: Date; endDate: Date } {
  const { startDate, endDate } = dashboardParamsSchema.parse(raw);
  return { startDate: new Date(startDate), endDate: new Date(endDate) };
}

export async function getDashboardSectionData(
  section: DashboardSection,
  raw: Record<string, unknown>,
): Promise<FinancialMetrics | PortfolioMetrics | ClientsMetrics | GeolocationResponse> {
  const { startDate, endDate } = parseAndValidate(raw);
  return withTenant(async () => {
    switch (section) {
      case 'financial':
        return await dashboardUseCases.getFinancial.execute(startDate, endDate);
      case 'portfolio':
        return await dashboardUseCases.getPortfolio.execute(startDate, endDate);
      case 'clients':
        return await dashboardUseCases.getClients.execute(startDate, endDate);
      case 'map':
        return await dashboardUseCases.getGeolocation.execute(startDate, endDate);
      default:
        throw new ValidationError('Seção de dashboard inválida');
    }
  });
}