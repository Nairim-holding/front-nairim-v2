import type { PlanningsRepository } from '@/core/repositories/plannings-repository';
import type {
  Planning,
  PlanningDashboardFilters,
  PlanningDashboardResponse,
  UpsertPlanningData,
} from '@/core/entities/planning';
import { ValidationError } from '@/core/errors/domain-errors';

/**
 * Casos de uso de Planejamento.
 * Camada: core. Origem: api-nairim-v2/src/services/PlanningService.ts +
 * PlanningValidator. Rodam dentro do contexto de tenant (withTenant).
 *
 * FIDELIDADE: validações e mensagens replicam o backend — category_id
 * obrigatório, type FIXED|VARIABLE, default_amount obrigatório para FIXED,
 * monthly_values obrigatório para VARIABLE (mês 1-12, sem duplicados, valores
 * não negativos), datas obrigatórias YYYY-MM-DD com startDate <= endDate.
 */

const MONTHS_RANGE = Array.from({ length: 12 }, (_, i) => i + 1);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isMonthValid(month: number): boolean {
  return MONTHS_RANGE.includes(month);
}

function isNonNegativeNumber(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false;
  const num = Number(value);
  return !Number.isNaN(num) && num >= 0;
}

export class UpsertPlanningUseCase {
  constructor(private readonly repository: PlanningsRepository) {}

  async execute(data: UpsertPlanningData): Promise<Planning> {
    if (!data.category_id?.trim()) throw new ValidationError('category_id é obrigatório');
    if (data.type !== 'FIXED' && data.type !== 'VARIABLE') {
      throw new ValidationError('type deve ser FIXED ou VARIABLE');
    }

    if (data.type === 'FIXED') {
      if (!isNonNegativeNumber(data.default_amount)) {
        throw new ValidationError('default_amount é obrigatório para planejamentos do tipo FIXED');
      }
    }

    if (data.type === 'VARIABLE') {
      const monthlyValues = data.monthly_values ?? [];
      if (!Array.isArray(monthlyValues) || monthlyValues.length === 0) {
        throw new ValidationError(
          'monthly_values é obrigatório para planejamentos do tipo VARIABLE e deve ser um array não vazio',
        );
      }

      const seen = new Set<number>();
      monthlyValues.forEach((mv, index) => {
        const month = Number(mv.month);
        if (!mv.month || isNaN(month) || !isMonthValid(month)) {
          throw new ValidationError(`monthly_values[${index}].month deve ser um número entre 1 e 12`);
        }
        if (seen.has(month)) {
          throw new ValidationError('monthly_values não pode conter meses duplicados');
        }
        seen.add(month);
        if (!isNonNegativeNumber(mv.amount)) {
          throw new ValidationError(`monthly_values[${index}].amount deve ser um número não negativo`);
        }
      });
    }

    // A unicidade do par (category, subcategory) é garantida em código dentro
    // do repositório (upsert). O backend faz o mesmo (null -> null, '' -> null).
    return this.repository.upsert({
      category_id: data.category_id,
      subcategory_id: data.subcategory_id ? String(data.subcategory_id) : null,
      type: data.type,
      default_amount: data.default_amount != null ? Number(data.default_amount) : null,
      monthly_values: data.monthly_values ?? [],
    });
  }
}

export class GetPlanningDashboardUseCase {
  constructor(private readonly repository: PlanningsRepository) {}

  async execute(
    startDate: string,
    endDate: string,
    filters?: PlanningDashboardFilters,
    sumPlannedOverPeriod?: boolean,
  ): Promise<PlanningDashboardResponse> {
    if (!DATE_RE.test(startDate)) {
      throw new ValidationError('startDate deve estar no formato YYYY-MM-DD');
    }
    if (!DATE_RE.test(endDate)) {
      throw new ValidationError('endDate deve estar no formato YYYY-MM-DD');
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime())) throw new ValidationError('startDate é uma data inválida');
    if (isNaN(end.getTime())) throw new ValidationError('endDate é uma data inválida');
    if (start > end) throw new ValidationError('startDate não pode ser maior que endDate');

    return this.repository.getDashboard(startDate, endDate, filters, sumPlannedOverPeriod);
  }
}

export class DeletePlanningUseCase {
  constructor(private readonly repository: PlanningsRepository) {}

  async execute(id: string): Promise<Planning> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    return this.repository.remove(id);
  }
}