import type { DashboardRepository } from '@/core/repositories/dashboard-repository';
import type {
  ClientsMetrics,
  FinancialMetrics,
  GeolocationResponse,
  PortfolioMetrics,
} from '@/core/entities/dashboard';
import { ValidationError } from '@/core/errors/domain-errors';

/**
 * Casos de uso do Dashboard (métricas financeiras, portfólio, clientes e
 * geolocalização). Camada: core. Origem: api-nairim-v2/src/services/DashboardService.ts
 * (métodos `getFinancialMetrics`, `getPortfolioMetrics`, `getClientsMetrics`,
 * `getGeolocation`).
 *
 * FIDELIDADE: mesmas regras do validateDashboardParams do backend — startDate e
 * endDate obrigatórios em YYYY-MM-DD, startDate <= endDate e intervalo máximo de
 * 5480 dias (~15 anos).
 *
 * ⚠️ Teto corrigido de 365→5480 dias na migração do Módulo 13 (ver
 * MIGRATION_STATUS.md) — mesma regressão silenciosa corrigida em
 * shared/validators/dashboard.ts (`dashboardParamsSchema`): o backend já
 * tinha ampliado esse limite depois que o Dashboard foi portado, e a mudança
 * nunca chegou a este arquivo.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MAX_RANGE_DAYS = 5480;

function assertPeriodValid(startDate: Date, endDate: Date): void {
  if (startDate > endDate) {
    throw new ValidationError('startDate não pode ser maior que endDate');
  }
  const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / MS_PER_DAY);
  if (diffDays > MAX_RANGE_DAYS) {
    throw new ValidationError('O intervalo máximo permitido é de 15 anos');
  }
}

function parseDate(value: unknown, label: 'startDate' | 'endDate'): Date {
  if (value === undefined || value === null || String(value) === '') {
    throw new ValidationError(`${label} é obrigatório`);
  }
  const raw = String(value);
  if (!DATE_RE.test(raw)) {
    throw new ValidationError(`${label} deve ser uma data válida no formato YYYY-MM-DD`);
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`${label} deve ser uma data válida no formato YYYY-MM-DD`);
  }
  return date;
}

/** Valida e normaliza o par de datas usado por todas as seções do dashboard. */
export function resolveDashboardPeriod(input: Record<string, unknown>): {
  startDate: Date;
  endDate: Date;
} {
  const startDate = parseDate(String(input.startDate ?? ''), 'startDate');
  const endDate = parseDate(String(input.endDate ?? ''), 'endDate');
  assertPeriodValid(startDate, endDate);
  return { startDate, endDate };
}

export abstract class GetDashboardMetricsUseCase<T> {
  protected constructor(protected readonly repository: DashboardRepository) {}

  abstract execute(
    startDate: Date,
    endDate: Date,
    input?: Record<string, unknown>,
  ): Promise<T>;
}

export class GetFinancialMetricsUseCase extends GetDashboardMetricsUseCase<FinancialMetrics> {
  constructor(repository: DashboardRepository) {
    super(repository);
  }

  execute(startDate: Date, endDate: Date): Promise<FinancialMetrics> {
    return this.repository.getFinancial(startDate, endDate);
  }
}

export class GetPortfolioMetricsUseCase extends GetDashboardMetricsUseCase<PortfolioMetrics> {
  constructor(repository: DashboardRepository) {
    super(repository);
  }

  execute(startDate: Date, endDate: Date): Promise<PortfolioMetrics> {
    return this.repository.getPortfolio(startDate, endDate);
  }
}

export class GetClientsMetricsUseCase extends GetDashboardMetricsUseCase<ClientsMetrics> {
  constructor(repository: DashboardRepository) {
    super(repository);
  }

  execute(startDate: Date, endDate: Date): Promise<ClientsMetrics> {
    return this.repository.getClients(startDate, endDate);
  }
}

export class GetGeolocationUseCase extends GetDashboardMetricsUseCase<GeolocationResponse> {
  constructor(repository: DashboardRepository) {
    super(repository);
  }

  execute(startDate: Date, endDate: Date): Promise<GeolocationResponse> {
    return this.repository.getGeolocation(startDate, endDate);
  }
}