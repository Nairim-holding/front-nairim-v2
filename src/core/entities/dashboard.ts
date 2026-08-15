/**
 * Entidades de dominio: Dashboard.
 *
 * Porte fiel de api-nairim-v2/src/types/dashboard.ts + DashboardService.ts
 * (métricas financeiras, portfólio, clientes e geolocalização).
 *
 * Camada: core. Origem: api-nairim-v2/src/services/DashboardService.ts.
 */

/** Seções do dashboard (uma por endpoint do backend). */
export type DashboardSection = 'financial' | 'portfolio' | 'clients' | 'map';

export interface DashboardParams {
  startDate: string;
  endDate: string;
}

/** Métrica com variação vs. período anterior + detalhes (`data`). */
export interface MetricResult {
  result: number;
  variation: number;
  isPositive: boolean;
  data: unknown[];
}

/** Dados de gráfico (agrupamento nome/valor + detalhes). */
export interface ChartData {
  name: string;
  value: number;
  data: unknown[];
}

export interface FinancialMetrics {
  averageRentalTicket: MetricResult;
  totalRentalActive: MetricResult;
  totalAcquisitionValue: MetricResult;
  financialVacancyRate: MetricResult;
  totalPropertyTaxAndCondoFee: MetricResult;
  vacancyInMonths: MetricResult;
}

export interface PortfolioMetrics {
  totalPropertys: MetricResult;
  countPropertiesWithLessThan3Docs: MetricResult;
  totalPropertiesWithSaleValue?: MetricResult;
  availablePropertiesByType: ChartData[];
  vacancyRate: MetricResult;
  occupationRate: MetricResult;
  physicalVacancy: MetricResult;
}

export interface ClientsMetrics {
  ownersTotal: MetricResult;
  tenantsTotal: MetricResult;
  propertiesPerOwner: MetricResult;
  agenciesTotal: MetricResult;
  propertiesByAgency: ChartData[];
}

export interface GeolocationPoint {
  lat: number;
  lng: number;
  info: string;
}

export interface GeolocationResponse {
  coordinates: GeolocationPoint[];
}

/** Períodos corrente e anterior para comparar a variação. */
export interface PeriodComparison {
  current: { start: Date; end: Date };
  previous: { start: Date; end: Date };
}