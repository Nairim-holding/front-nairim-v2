import { PrismaDashboardRepository } from '@/infra/repositories/prisma-dashboard-repository';
import {
  GetClientsMetricsUseCase,
  GetFinancialMetricsUseCase,
  GetGeolocationUseCase,
  GetPortfolioMetricsUseCase,
} from '@/core/use-cases/dashboard/crud';

/** Composition root do módulo Dashboard. Camada: infra. */
const dashboard = new PrismaDashboardRepository();

export const dashboardUseCases = {
  getFinancial: new GetFinancialMetricsUseCase(dashboard),
  getPortfolio: new GetPortfolioMetricsUseCase(dashboard),
  getClients: new GetClientsMetricsUseCase(dashboard),
  getGeolocation: new GetGeolocationUseCase(dashboard),
};