import type {
  ClientsMetrics,
  FinancialMetrics,
  GeolocationResponse,
  PortfolioMetrics,
} from '@/core/entities/dashboard';

/**
 * Contrato do repositório de Dashboard (métricas agregadas).
 * Camada: core. Origem: api-nairim-v2/src/services/DashboardService.ts.
 */
export interface DashboardRepository {
  getFinancial(startDate: Date, endDate: Date): Promise<FinancialMetrics>;
  getPortfolio(startDate: Date, endDate: Date): Promise<PortfolioMetrics>;
  getClients(startDate: Date, endDate: Date): Promise<ClientsMetrics>;
  getGeolocation(startDate: Date, endDate: Date): Promise<GeolocationResponse>;
}