import { describe, it, expect, beforeEach } from 'vitest';
import type { PlanningsRepository } from '@/core/repositories/plannings-repository';
import type {
  Planning,
  PlanningDashboardFilters,
  PlanningDashboardResponse,
  UpsertPlanningData,
} from '@/core/entities/planning';
import {
  DeletePlanningUseCase,
  GetPlanningDashboardUseCase,
  UpsertPlanningUseCase,
} from '@/core/use-cases/planning/crud';
import { ValidationError } from '@/core/errors/domain-errors';

const now = new Date('2026-08-09T12:00:00Z');

function makePlanning(over: Partial<Planning> = {}): Planning {
  return {
    id: 'p-1',
    company_id: 'c-1',
    category_id: 'cat-1',
    subcategory_id: null,
    type: 'FIXED',
    default_amount: 100,
    min_recommended: null,
    max_recommended: null,
    is_active: true,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    monthly_values: [],
    ...over,
  };
}

class InMemoryPlanningsRepository implements PlanningsRepository {
  plannings: Planning[] = [];
  dashboard: PlanningDashboardResponse | null = null;

  async upsert(data: UpsertPlanningData & { company_id?: string }): Promise<Planning> {
    const existing = this.plannings.find(
      (p) =>
        !p.deleted_at &&
        p.category_id === data.category_id &&
        (p.subcategory_id ?? null) === (data.subcategory_id ?? null),
    );
    const p: Planning = existing
      ? { ...existing, ...data, default_amount: data.default_amount ?? null, updated_at: now }
      : makePlanning({
          id: `p-${this.plannings.length + 1}`,
          company_id: data.company_id ?? 'c-1',
          category_id: data.category_id,
          subcategory_id: data.subcategory_id ?? null,
          type: data.type,
          default_amount: data.default_amount ?? null,
        });
    p.monthly_values = (data.monthly_values ?? []).map((mv) => ({ month: mv.month, amount: mv.amount }));
    if (existing) {
      this.plannings = this.plannings.map((x) => (x.id === existing.id ? p : x));
    } else {
      this.plannings.push(p);
    }
    return p;
  }

  async remove(id: string): Promise<Planning> {
    const p = this.plannings.find((x) => x.id === id && !x.deleted_at);
    if (!p) throw new ValidationError('Planning not found');
    p.deleted_at = now;
    return p;
  }

  async getDashboard(
    startDate: string,
    endDate: string,
    filters?: PlanningDashboardFilters,
  ): Promise<PlanningDashboardResponse> {
    if (!this.dashboard) {
      return {
        start_date: startDate,
        end_date: endDate,
        balances: { monthly: [], accumulated: [] },
        incomes: [],
        expenses: [],
      };
    }
    return this.dashboard;
  }
}

describe('Planning use cases', () => {
  let repo: InMemoryPlanningsRepository;
  let upsert: UpsertPlanningUseCase;
  let remove: DeletePlanningUseCase;
  let getDashboard: GetPlanningDashboardUseCase;

  beforeEach(() => {
    repo = new InMemoryPlanningsRepository();
    upsert = new UpsertPlanningUseCase(repo);
    remove = new DeletePlanningUseCase(repo);
    getDashboard = new GetPlanningDashboardUseCase(repo);
  });

  describe('UpsertPlanningUseCase', () => {
    it('rejeita category_id vazio', async () => {
      await expect(
        upsert.execute({ category_id: '', type: 'FIXED', default_amount: 100 }),
      ).rejects.toThrow(ValidationError);
    });

    it('rejeita type inválido', async () => {
      await expect(
        upsert.execute({ category_id: 'cat-1', type: 'MENSAL' as never, default_amount: 100 }),
      ).rejects.toThrow('type deve ser FIXED ou VARIABLE');
    });

    it('FIXED exige default_amount não negativo', async () => {
      await expect(
        upsert.execute({ category_id: 'cat-1', type: 'FIXED', default_amount: -5 }),
      ).rejects.toThrow('default_amount é obrigatório');
      await expect(
        upsert.execute({ category_id: 'cat-1', type: 'FIXED' }),
      ).rejects.toThrow('default_amount é obrigatório');
    });

    it('VARIABLE exige monthly_values não vazio', async () => {
      await expect(
        upsert.execute({ category_id: 'cat-1', type: 'VARIABLE', monthly_values: [] }),
      ).rejects.toThrow('monthly_values é obrigatório');
    });

    it('VARIABLE valida mês 1..12', async () => {
      await expect(
        upsert.execute({ category_id: 'cat-1', type: 'VARIABLE', monthly_values: [{ month: 13, amount: 1 }] }),
      ).rejects.toThrow('entre 1 e 12');
    });

    it('VARIABLE rejeita meses duplicados', async () => {
      await expect(
        upsert.execute({
          category_id: 'cat-1',
          type: 'VARIABLE',
          monthly_values: [
            { month: 1, amount: 10 },
            { month: 1, amount: 20 },
          ],
        }),
      ).rejects.toThrow('meses duplicados');
    });

    it('VARIABLE rejeita amount negativo', async () => {
      await expect(
        upsert.execute({ category_id: 'cat-1', type: 'VARIABLE', monthly_values: [{ month: 2, amount: -1 }] }),
      ).rejects.toThrow('não negativo');
    });

    it('normaliza subcategory_id vazio para null e chama o repositório', async () => {
      const result = await upsert.execute({
        category_id: 'cat-1',
        subcategory_id: '',
        type: 'FIXED',
        default_amount: 50,
      });
      expect(result.subcategory_id).toBeNull();
      expect(result.default_amount).toBe(50);
      expect(result.type).toBe('FIXED');
    });
  });

  describe('GetPlanningDashboardUseCase', () => {
    it('rejeita startDate fora do formato', async () => {
      await expect(getDashboard.execute('01/01/2026', '2026-12-31')).rejects.toThrow(
        'startDate deve estar no formato YYYY-MM-DD',
      );
    });

    it('rejeita endDate fora do formato', async () => {
      await expect(getDashboard.execute('2026-01-01', 'invalida')).rejects.toThrow(
        'endDate deve estar no formato YYYY-MM-DD',
      );
    });

    it('rejeita startDate > endDate', async () => {
      await expect(getDashboard.execute('2026-12-31', '2026-01-01')).rejects.toThrow(
        'startDate não pode ser maior que endDate',
      );
    });

    it('delega para o repositório com datas válidas e filtros', async () => {
      const filters = { category_id: ['cat-1'] };
      const result = await getDashboard.execute('2026-01-01', '2026-12-31', filters);
      expect(result.start_date).toBe('2026-01-01');
      expect(result.end_date).toBe('2026-12-31');
    });
  });

  describe('DeletePlanningUseCase', () => {
    it('rejeita ID vazio', async () => {
      await expect(remove.execute('')).rejects.toThrow('O ID é obrigatório');
    });

    it('deleta planejamento existente', async () => {
      await upsert.execute({ category_id: 'cat-1', type: 'FIXED', default_amount: 100 });
      const deleted = await remove.execute('p-1');
      expect(deleted.id).toBe('p-1');
      expect(deleted.deleted_at).not.toBeNull();
    });
  });
});