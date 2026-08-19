import { describe, it, expect } from 'vitest';
import type { DashboardRepository } from '@/core/repositories/dashboard-repository';
import type {
  ClientsMetrics,
  FinancialMetrics,
  GeolocationResponse,
  PortfolioMetrics,
} from '@/core/entities/dashboard';
import {
  GetClientsMetricsUseCase,
  GetFinancialMetricsUseCase,
  GetGeolocationUseCase,
  GetPortfolioMetricsUseCase,
  resolveDashboardPeriod,
} from '@/core/use-cases/dashboard/crud';
import {
  calcVariation,
  calculateVacancyMonths,
  getPeriodDatesIn,
} from '@/core/utils/dashboard-metrics';
import { ValidationError } from '@/core/errors/domain-errors';

/**
 * Testes do módulo Dashboard (Módulo 11).
 *  - `resolveDashboardPeriod`: fidelidade ao `validateDashboardParams` do backend
 *    (obrigatórios, formato YYYY-MM-DD, start<=end, máx. 365 dias).
 *  - Helpers puros do repositório (`calcVariation`, `calculateVacancyMonths`,
 *    `getPeriodDatesIn`), portados 1:1 de DashboardService.
 *  - Delegação dos use-cases ao repositório.
 */

const emptyFinancial: FinancialMetrics = {
  averageRentalTicket: { result: 0, variation: 0, isPositive: true, data: [] },
  totalRentalActive: { result: 0, variation: 0, isPositive: true, data: [] },
  totalAcquisitionValue: { result: 0, variation: 0, isPositive: true, data: [] },
  financialVacancyRate: { result: 0, variation: 0, isPositive: true, data: [] },
  totalPropertyTaxAndCondoFee: { result: 0, variation: 0, isPositive: true, data: [] },
  vacancyInMonths: { result: 0, variation: 0, isPositive: true, data: [] },
};

class InMemoryDashboardRepository implements DashboardRepository {
  financial: FinancialMetrics = emptyFinancial;
  portfolio: PortfolioMetrics = {
    totalPropertys: emptyFinancial.averageRentalTicket,
    countPropertiesWithLessThan3Docs: emptyFinancial.averageRentalTicket,
    availablePropertiesByType: [],
    vacancyRate: emptyFinancial.averageRentalTicket,
    occupationRate: emptyFinancial.averageRentalTicket,
    physicalVacancy: emptyFinancial.averageRentalTicket,
  };
  clients: ClientsMetrics = {
    ownersTotal: emptyFinancial.averageRentalTicket,
    tenantsTotal: emptyFinancial.averageRentalTicket,
    propertiesPerOwner: emptyFinancial.averageRentalTicket,
    agenciesTotal: emptyFinancial.averageRentalTicket,
    propertiesByAgency: [],
  };
  geolocation: GeolocationResponse = { coordinates: [] };

  calls: string[] = [];

  async getFinancial(_start: Date, _end: Date): Promise<FinancialMetrics> {
    this.calls.push('financial');
    return this.financial;
  }
  async getPortfolio(_start: Date, _end: Date): Promise<PortfolioMetrics> {
    this.calls.push('portfolio');
    return this.portfolio;
  }
  async getClients(_start: Date, _end: Date): Promise<ClientsMetrics> {
    this.calls.push('clients');
    return this.clients;
  }
  async getGeolocation(_start: Date, _end: Date): Promise<GeolocationResponse> {
    this.calls.push('map');
    return this.geolocation;
  }
}

describe('resolveDashboardPeriod (fidelidade ao validateDashboardParams)', () => {
  it('aceita um período válido', () => {
    const { startDate, endDate } = resolveDashboardPeriod({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });
    expect(startDate.getTime()).toBe(new Date('2026-01-01').getTime());
    expect(endDate.getTime()).toBe(new Date('2026-01-31').getTime());
  });

  it('rejeita startDate ausente', () => {
    expect(() => resolveDashboardPeriod({ endDate: '2026-01-31' })).toThrow(
      new ValidationError('startDate é obrigatório'),
    );
  });

  it('rejeita endDate ausente', () => {
    expect(() => resolveDashboardPeriod({ startDate: '2026-01-01' })).toThrow(
      new ValidationError('endDate é obrigatório'),
    );
  });

  it('rejeita formato inválido', () => {
    expect(() =>
      resolveDashboardPeriod({ startDate: '01/01/2026', endDate: '2026-01-31' }),
    ).toThrow(new ValidationError('startDate deve ser uma data válida no formato YYYY-MM-DD'));
    expect(() =>
      resolveDashboardPeriod({ startDate: '2026-01-01', endDate: '2026-13-40' }),
    ).toThrow(new ValidationError('endDate deve ser uma data válida no formato YYYY-MM-DD'));
  });

  it('rejeita startDate maior que endDate', () => {
    expect(() =>
      resolveDashboardPeriod({ startDate: '2026-02-01', endDate: '2026-01-01' }),
    ).toThrow(new ValidationError('startDate não pode ser maior que endDate'));
  });

  // O teto foi ampliado de 365 para 5480 dias (~15 anos) junto com o backend —
  // é o que permite o "período limpo" do Dashboard varrer todo o histórico.
  it('rejeita intervalo maior que 15 anos', () => {
    expect(() =>
      resolveDashboardPeriod({ startDate: '2010-01-01', endDate: '2026-01-31' }),
    ).toThrow(new ValidationError('O intervalo máximo permitido é de 15 anos'));
  });

  it('aceita um intervalo de vários anos dentro do teto', () => {
    expect(() =>
      resolveDashboardPeriod({ startDate: '2020-01-01', endDate: '2026-01-01' }),
    ).not.toThrow();
  });
});

describe('calcVariation (fidelidade ao DashboardService)', () => {
  it('retorna variação 0 quando não há base anterior (previous === 0)', () => {
    const m = calcVariation(150, 0);
    expect(m.result).toBe(150);
    expect(m.variation).toBe(0);
    expect(m.isPositive).toBe(true);
    expect(m.data).toEqual([]);
  });

  it('calcula variação positiva com 2 casas decimais', () => {
    const m = calcVariation(120, 100);
    expect(m.result).toBe(120);
    expect(m.variation).toBe(20);
    expect(m.isPositive).toBe(true);
  });

  it('calcula variação negativa', () => {
    const m = calcVariation(80, 100);
    expect(m.variation).toBe(-20);
    expect(m.isPositive).toBe(false);
  });

  it('limita a variação a +100/-100', () => {
    expect(calcVariation(500, 100).variation).toBe(100);
    expect(calcVariation(0, 100).variation).toBe(-100);
  });

  it('mantém os detalhes informados em data', () => {
    const item: unknown[] = [{ id: 'p1', title: 'Casa' }];
    expect(calcVariation(5, 3, item).data).toEqual(item);
  });
});

describe('calculateVacancyMonths (fidelidade ao DashboardService)', () => {
  const ref = new Date('2026-08-15');

  it('sem leases retorna 12', () => {
    expect(calculateVacancyMonths([], ref)).toBe(12);
    expect(calculateVacancyMonths(undefined, ref)).toBe(12);
    expect(calculateVacancyMonths(null, ref)).toBe(12);
  });

  it('lease com end_date no futuro retorna 0', () => {
    expect(calculateVacancyMonths([{ end_date: new Date('2026-12-01') }], ref)).toBe(0);
  });

  it('calcula meses completos após o fim do último lease', () => {
    // Lease terminou em 2025-06-10; ref 2026-08-15 (2026-2025)*12 + (8-6) = 14
    expect(calculateVacancyMonths([{ end_date: new Date('2025-06-10') }], ref)).toBe(14);
  });

  it('nunca retorna valor negativo', () => {
    // Lease terminou dezembro passado, ref é janeiro
    expect(
      calculateVacancyMonths([{ end_date: new Date('2025-06-10') }], new Date('2025-05-01')),
    ).toBe(0);
  });
});

describe('getPeriodDatesIn (fidelidade ao DashboardService)', () => {
  it('define current e previous com base na diferença do período', () => {
    const start = new Date('2026-08-01');
    const end = new Date('2026-08-31');
    const p = getPeriodDatesIn(start, end);
    expect(p.current.start).toBe(start);
    expect(p.current.end).toBe(end);
    // previous.end = start - 1ms
    expect(p.previous.end.getTime()).toBe(start.getTime() - 1);
    // previous.start = start - diffMs - 1
    expect(p.previous.start.getTime()).toBe(start.getTime() - (end.getTime() - start.getTime()) - 1);
  });
});

describe('Dashboard use-cases', () => {
  it('GetFinancialMetricsUseCase delega para o repositório', async () => {
    const repo = new InMemoryDashboardRepository();
    const result = await new GetFinancialMetricsUseCase(repo).execute(
      new Date('2026-01-01'),
      new Date('2026-01-31'),
    );
    expect(result).toEqual(emptyFinancial);
    expect(repo.calls).toContain('financial');
  });

  it('GetPortfolioMetricsUseCase delega para o repositório', async () => {
    const repo = new InMemoryDashboardRepository();
    await new GetPortfolioMetricsUseCase(repo).execute(new Date('2026-01-01'), new Date('2026-01-31'));
    expect(repo.calls).toContain('portfolio');
  });

  it('GetClientsMetricsUseCase delega para o repositório', async () => {
    const repo = new InMemoryDashboardRepository();
    await new GetClientsMetricsUseCase(repo).execute(new Date('2026-01-01'), new Date('2026-01-31'));
    expect(repo.calls).toContain('clients');
  });

  it('GetGeolocationUseCase delega para o repositório', async () => {
    const repo = new InMemoryDashboardRepository();
    await new GetGeolocationUseCase(repo).execute(new Date('2026-01-01'), new Date('2026-01-31'));
    expect(repo.calls).toContain('map');
  });
});