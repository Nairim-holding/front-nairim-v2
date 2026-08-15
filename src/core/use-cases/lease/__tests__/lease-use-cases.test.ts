import { describe, it, expect, beforeEach } from 'vitest';
import type { LeasesRepository } from '@/core/repositories/leases-repository';
import type { LeaseFinanceRepository } from '@/core/repositories/lease-finance-repository';
import type {
  CancelLeaseInput, CancelLeaseResult, CancellationPreview, CreateLeaseData,
  Lease, ListLeasesParams, PaginatedLeases, SyncLeaseTransactionsResult, UpdateLeaseData,
} from '@/core/entities/lease';
import {
  CreateLeaseUseCase, UpdateLeaseUseCase, DeleteLeaseUseCase,
  PermanentlyDeleteLeaseUseCase, RestoreLeaseUseCase, GetLeaseByIdUseCase,
} from '@/core/use-cases/lease/crud';
import { GetCancellationPreviewUseCase, CancelLeaseUseCase } from '@/core/use-cases/lease/cancellation';
import { validateLeaseBusinessRules } from '@/shared/validators/lease';
import { ConflictError, NotFoundError, ValidationError } from '@/core/errors/domain-errors';

/** Repositório em memória — espelha os contratos do PrismaLeasesRepository. */
class InMemoryLeasesRepository implements LeasesRepository {
  items: Lease[] = [];
  /** Mapa imóvel → categoria (null = imóvel sem categoria). */
  propertyCategories: Record<string, string | null> = {};
  canceledIds: string[] = [];

  async list(params: ListLeasesParams): Promise<PaginatedLeases> {
    const active = this.items.filter((l) => !l.deleted_at);
    return { data: active, count: active.length, totalPages: 1, currentPage: params.page };
  }
  async getFilters(): Promise<Record<string, unknown>> { return { filters: [] }; }
  async findById(id: string): Promise<Lease | null> {
    return this.items.find((l) => l.id === id && !l.deleted_at) ?? null;
  }
  async contractNumberExists(contractNumber: string): Promise<boolean> {
    return this.items.some((l) => l.contract_number === contractNumber && !l.deleted_at);
  }
  async contractNumberExistsExcept(contractNumber: string, exceptId: string): Promise<boolean> {
    return this.items.some((l) => l.contract_number === contractNumber && !l.deleted_at && l.id !== exceptId);
  }
  async getPropertyCategoryId(propertyId: string): Promise<string | null> {
    return this.propertyCategories[propertyId] ?? null;
  }
  async create(data: CreateLeaseData): Promise<Lease> {
    const now = new Date();
    const lease = {
      id: `l-${this.items.length + 1}`, company_id: 'c-1', status: 'ACTIVE',
      ...data, created_at: now, updated_at: now, deleted_at: null,
    } as unknown as Lease;
    this.items.push(lease);
    return lease;
  }
  async update(id: string, data: UpdateLeaseData): Promise<Lease> {
    const l = this.items.find((x) => x.id === id)!;
    Object.assign(l, data);
    return l;
  }
  async softDelete(id: string): Promise<Lease | null> {
    const l = this.items.find((x) => x.id === id && !x.deleted_at);
    if (!l) return null;
    l.deleted_at = new Date();
    l.status = 'CANCELED';
    return l;
  }
  async permanentlyDelete(id: string): Promise<Lease | null> {
    const idx = this.items.findIndex((x) => x.id === id);
    if (idx < 0) return null;
    const [l] = this.items.splice(idx, 1);
    return l;
  }
  async restore(id: string): Promise<Lease | null> {
    const l = this.items.find((x) => x.id === id);
    if (!l) return null;
    l.deleted_at = null;
    l.status = 'ACTIVE';
    return l;
  }
  async getCancellationPreview(id: string, date: string): Promise<CancellationPreview | null> {
    const l = this.items.find((x) => x.id === id && !x.deleted_at);
    if (!l) return null;
    return {
      lease: { id: l.id, contract_number: l.contract_number, start_date: l.start_date, end_date: l.end_date },
      from: new Date(date), to: l.end_date, transactions: [], count: 0, total: 0,
    } as unknown as CancellationPreview;
  }
  async cancel(id: string, input: CancelLeaseInput, companyId: string): Promise<CancelLeaseResult | null> {
    const l = this.items.find((x) => x.id === id && !x.deleted_at);
    if (!l) return null;
    l.status = 'CANCELED';
    this.canceledIds.push(`${id}:${companyId}:${input.date}`);
    return { canceled: true } as unknown as CancelLeaseResult;
  }
  async exists(id: string): Promise<boolean> {
    return this.items.some((x) => x.id === id && !x.deleted_at);
  }
  async removeDocuments(): Promise<void> { /* noop */ }
  async createDocuments(): Promise<void> { /* noop */ }
}

/** Sincronizador financeiro fake — configurável para sucesso/warning/erro. */
class FakeLeaseFinanceRepository implements LeaseFinanceRepository {
  result: SyncLeaseTransactionsResult = { generated: 3 };
  shouldThrow = false;
  calls: Array<{ leaseId: string; companyId: string }> = [];

  async syncLeaseTransactions(leaseId: string, companyId: string): Promise<SyncLeaseTransactionsResult> {
    this.calls.push({ leaseId, companyId });
    if (this.shouldThrow) throw new Error('DB down');
    return this.result;
  }
}

const baseData: CreateLeaseData = {
  property_id: 'p-1', type_id: 't-1', owner_id: 'o-1', tenant_id: 'ten-1',
  contract_number: 'CT-001', start_date: '2026-01-01', end_date: '2026-12-31',
  rent_amount: 1500, rent_due_day: 5,
};

describe('Lease use-cases', () => {
  let repo: InMemoryLeasesRepository;
  let finance: FakeLeaseFinanceRepository;

  beforeEach(() => {
    repo = new InMemoryLeasesRepository();
    finance = new FakeLeaseFinanceRepository();
    repo.propertyCategories['p-1'] = 'cat-1';
  });

  describe('CreateLeaseUseCase', () => {
    it('cria a locação e sincroniza os lançamentos financeiros', async () => {
      const uc = new CreateLeaseUseCase(repo, finance);
      const lease = await uc.execute(baseData);
      expect(lease.contract_number).toBe('CT-001');
      expect(lease.finance_warning).toBeUndefined();
      expect(finance.calls).toEqual([{ leaseId: lease.id, companyId: 'c-1' }]);
    });

    it('rejeita imóvel sem categoria (400)', async () => {
      repo.propertyCategories['p-1'] = null;
      const uc = new CreateLeaseUseCase(repo, finance);
      await expect(uc.execute(baseData)).rejects.toBeInstanceOf(ValidationError);
    });

    it('rejeita contract_number duplicado (409)', async () => {
      const uc = new CreateLeaseUseCase(repo, finance);
      await uc.execute(baseData);
      await expect(uc.execute(baseData)).rejects.toBeInstanceOf(ConflictError);
    });

    it('anexa finance_warning quando a sincronização financeira falha (locação persiste)', async () => {
      finance.shouldThrow = true;
      const uc = new CreateLeaseUseCase(repo, finance);
      const lease = await uc.execute(baseData);
      expect(lease.finance_warning).toContain('lançamentos financeiros');
      expect(repo.items).toHaveLength(1);
    });

    it('propaga o warning retornado pela sincronização', async () => {
      finance.result = { generated: 0, warning: 'Sem categoria de comissão' };
      const uc = new CreateLeaseUseCase(repo, finance);
      const lease = await uc.execute(baseData);
      expect(lease.finance_warning).toBe('Sem categoria de comissão');
    });
  });

  describe('UpdateLeaseUseCase', () => {
    it('404 quando a locação não existe', async () => {
      const uc = new UpdateLeaseUseCase(repo, finance);
      await expect(uc.execute('nope', { rent_amount: 2000 })).rejects.toBeInstanceOf(NotFoundError);
    });

    it('409 quando o contract_number pertence a outra locação', async () => {
      const create = new CreateLeaseUseCase(repo, finance);
      await create.execute(baseData);
      const second = await create.execute({ ...baseData, contract_number: 'CT-002' });
      const uc = new UpdateLeaseUseCase(repo, finance);
      await expect(uc.execute(second.id, { contract_number: 'CT-001' })).rejects.toBeInstanceOf(ConflictError);
    });

    it('permite manter o próprio contract_number e re-sincroniza o financeiro', async () => {
      const create = new CreateLeaseUseCase(repo, finance);
      const lease = await create.execute(baseData);
      finance.calls = [];
      const uc = new UpdateLeaseUseCase(repo, finance);
      const updated = await uc.execute(lease.id, { contract_number: 'CT-001', rent_amount: 1800 });
      expect(updated.rent_amount).toBe(1800);
      expect(finance.calls).toHaveLength(1);
    });
  });

  describe('Delete/PermanentlyDelete/Restore', () => {
    it('soft-delete: 404 quando não existe; cancela quando existe', async () => {
      const create = new CreateLeaseUseCase(repo, finance);
      const lease = await create.execute(baseData);
      const del = new DeleteLeaseUseCase(repo);
      await expect(del.execute('nope')).rejects.toBeInstanceOf(NotFoundError);
      const deleted = await del.execute(lease.id);
      expect(deleted.status).toBe('CANCELED');
    });

    it('exclusão definitiva: 404 quando não existe; remove quando existe', async () => {
      const create = new CreateLeaseUseCase(repo, finance);
      const lease = await create.execute(baseData);
      const uc = new PermanentlyDeleteLeaseUseCase(repo);
      await expect(uc.execute('nope')).rejects.toBeInstanceOf(NotFoundError);
      await uc.execute(lease.id);
      expect(repo.items).toHaveLength(0);
    });

    it('restore reativa uma locação soft-deletada', async () => {
      const create = new CreateLeaseUseCase(repo, finance);
      const lease = await create.execute(baseData);
      await new DeleteLeaseUseCase(repo).execute(lease.id);
      const restored = await new RestoreLeaseUseCase(repo).execute(lease.id);
      expect(restored.status).toBe('ACTIVE');
      expect(restored.deleted_at).toBeNull();
    });
  });

  describe('GetLeaseByIdUseCase', () => {
    it('400 sem id; 404 quando não existe', async () => {
      const uc = new GetLeaseByIdUseCase(repo);
      await expect(uc.execute('')).rejects.toBeInstanceOf(ValidationError);
      await expect(uc.execute('nope')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('Cancelamento', () => {
    it('prévia: exige id e data; 404 quando não existe', async () => {
      const uc = new GetCancellationPreviewUseCase(repo);
      await expect(uc.execute('', '2026-06-01')).rejects.toBeInstanceOf(ValidationError);
      await expect(uc.execute('l-1', '')).rejects.toBeInstanceOf(ValidationError);
      await expect(uc.execute('nope', '2026-06-01')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('cancel: exige data, 404 quando não existe, repassa companyId', async () => {
      const create = new CreateLeaseUseCase(repo, finance);
      const lease = await create.execute(baseData);
      const uc = new CancelLeaseUseCase(repo);
      await expect(uc.execute(lease.id, { date: '' } as CancelLeaseInput, 'c-1')).rejects.toBeInstanceOf(ValidationError);
      await expect(uc.execute('nope', { date: '2026-06-01' }, 'c-1')).rejects.toBeInstanceOf(NotFoundError);
      await uc.execute(lease.id, { date: '2026-06-01' }, 'c-1');
      expect(repo.canceledIds).toContain(`${lease.id}:c-1:2026-06-01`);
      expect((await repo.findById(lease.id))?.status).toBe('CANCELED');
    });
  });
});

describe('validateLeaseBusinessRules (warnings/erros do LeaseValidator)', () => {
  it('bloqueia start_date >= end_date', () => {
    expect(() => validateLeaseBusinessRules(
      { rent_due_day: 5, start_date: '2026-12-31', end_date: '2026-01-01' }, false,
    )).toThrow(ValidationError);
  });

  it('bloqueia rent_due_day ausente no create; não bloqueia no update', () => {
    expect(() => validateLeaseBusinessRules({}, false)).toThrow(ValidationError);
    expect(() => validateLeaseBusinessRules({}, true)).not.toThrow();
  });

  it('avisa (sem bloquear) quando rent_amount não é informado no create', () => {
    const warnings = validateLeaseBusinessRules({ rent_due_day: 5 }, false);
    expect(warnings).toContain('Valor do aluguel não foi informado');
  });

  it('avisa quando o valor à vista sai da faixa permitida [85%, 100%] da base', () => {
    // Base 1000 → faixa válida: R$ 850 a R$ 1.000. Valor 800 fica abaixo do mínimo.
    const warnings = validateLeaseBusinessRules({
      rent_due_day: 5,
      property_tax: 1000,
      payment_condition: 'IN_FULL_15_DISCOUNT',
      property_tax_cash: 800,
    }, false);
    expect(warnings.some((w) => w.includes('15%'))).toBe(true);
  });

  it('não avisa quando o valor à vista está dentro da faixa (ex.: 15% de desconto exato)', () => {
    const warnings = validateLeaseBusinessRules({
      rent_due_day: 5,
      property_tax: 1000,
      payment_condition: 'IN_FULL_15_DISCOUNT',
      property_tax_cash: 850,
    }, false);
    expect(warnings.some((w) => w.includes('15%'))).toBe(false);
  });

  it('avisa quando a soma das parcelas livres difere do valor base', () => {
    const warnings = validateLeaseBusinessRules({
      rent_due_day: 5,
      property_tax: 1000,
      payment_condition: 'INSTALLMENTS',
      iptu_installments: [300, 300],
    }, false);
    expect(warnings.length).toBeGreaterThan(0);
  });
});

/*
 * Testa os casos de uso migrados de:
 *  - api-nairim-v2/src/services/LeaseService.ts (create/update/delete/restore/cancel)
 *  - api-nairim-v2/src/lib/validators/lease.ts (warnings de IPTU/regras de negócio)
 */
