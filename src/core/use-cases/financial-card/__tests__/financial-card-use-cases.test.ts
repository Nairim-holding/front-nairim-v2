import { describe, it, expect, beforeEach } from 'vitest';
import type { CardsRepository } from '@/core/repositories/financial-cards-repository';
import type {
  Card,
  CardUsageFilters,
  CreateCardData,
  ListCardsParams,
  PaginatedCards,
  UpdateCardData,
} from '@/core/entities/financial-card';
import {
  CreateCardUseCase,
  DeleteCardUseCase,
  GetCardByIdUseCase,
  GetCardFiltersUseCase,
  GetCardUsageSummaryUseCase,
  ListCardsUseCase,
  QuickCreateCardUseCase,
  RestoreCardUseCase,
  UpdateCardUseCase,
} from '@/core/use-cases/financial-card/crud';
import { ConflictError, NotFoundError, ValidationError } from '@/core/errors/domain-errors';

class InMemoryCardsRepository implements CardsRepository {
  items: (Card & { deleted_at: Date | null })[] = [];
  transactionsByCard: Record<string, number> = {};

  async list(params: ListCardsParams): Promise<PaginatedCards> {
    const active = this.items.filter((c) => params.includeInactive || !c.deleted_at);
    return { data: active, count: active.length, totalPages: 1, currentPage: params.page };
  }
  async getFilters() { return { filters: [] }; }
  async findById(id: string) {
    return this.items.find((c) => c.id === id && !c.deleted_at) ?? null;
  }
  async create(data: CreateCardData) {
    const now = new Date();
    const card = {
      id: `card-${this.items.length + 1}`, name: data.name, limit: data.limit ?? 0,
      closing_day: data.closing_day ?? null, due_day: data.due_day ?? null,
      is_active: data.is_active ?? true, brand: 'Outro', current_balance: 0, company_id: 'c-1',
      created_at: now, updated_at: now, deleted_at: null,
    } as Card & { deleted_at: Date | null };
    this.items.push(card);
    return card;
  }
  async update(id: string, data: UpdateCardData) {
    const card = this.items.find((x) => x.id === id)!;
    Object.assign(card, data);
    return card;
  }
  async softDelete(id: string) {
    const card = this.items.find((x) => x.id === id && !x.deleted_at);
    if (!card) throw new NotFoundError('Cartão não encontrado ou já excluído');
    if (this.transactionsByCard[id]) {
      throw new ConflictError('Não é possível excluir o cartão pois existem lançamentos vinculados.');
    }
    card.deleted_at = new Date();
    return card;
  }
  async findDeletionState(id: string) {
    const card = this.items.find((x) => x.id === id);
    return card ? { id: card.id, deleted_at: card.deleted_at } : null;
  }
  async restore(id: string) {
    const card = this.items.find((x) => x.id === id)!;
    card.deleted_at = null;
    return card;
  }
  async quickCreate(data: { name: string }) {
    const norm = data.name.toLowerCase();
    const existing = this.items.find((c) => c.name.toLowerCase() === norm && !c.deleted_at);
    if (existing) return existing;
    return this.create({ name: data.name });
  }
  async getUsageSummary(_start: Date, _end: Date, _filters: CardUsageFilters) {
    return [];
  }
}

function seed(repo: InMemoryCardsRepository, over: Partial<Card> = {}) {
  const now = new Date();
  repo.items.push({
    id: 'card-1', name: 'Nubank', limit: 7000, closing_day: 10, due_day: 15,
    is_active: true, brand: 'Outro', current_balance: 0, company_id: 'c-1',
    created_at: now, updated_at: now, deleted_at: null, ...over,
  } as Card & { deleted_at: Date | null });
}

describe('FinancialCard use-cases', () => {
  let repo: InMemoryCardsRepository;
  beforeEach(() => { repo = new InMemoryCardsRepository(); });

  describe('CreateCardUseCase', () => {
    it('cria cartão com defaults', async () => {
      const out = await new CreateCardUseCase(repo).execute({ name: 'Nubank' });
      expect(out.name).toBe('Nubank');
      expect(out.is_active).toBe(true);
      expect(out.limit).toBe(0);
    });
    it('rejeita nome vazio (400)', async () => {
      await expect(new CreateCardUseCase(repo).execute({ name: '  ' })).rejects.toBeInstanceOf(ValidationError);
    });
    it('rejeita limite não numérico (400)', async () => {
      await expect(new CreateCardUseCase(repo).execute({ name: 'X', limit: Number('a') })).rejects.toBeInstanceOf(ValidationError);
    });
    it('rejeita fechamento fora de 1..31 (400)', async () => {
      await expect(new CreateCardUseCase(repo).execute({ name: 'X', closing_day: 32 })).rejects.toBeInstanceOf(ValidationError);
    });
    it('rejeita vencimento fora de 1..31 (400)', async () => {
      await expect(new CreateCardUseCase(repo).execute({ name: 'X', due_day: 0 })).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('UpdateCardUseCase', () => {
    it('lança NotFound se não existe', async () => {
      await expect(new UpdateCardUseCase(repo).execute('ghost', { name: 'X' })).rejects.toBeInstanceOf(NotFoundError);
    });
    it('rejeita nome vazio no update (400)', async () => {
      seed(repo);
      await expect(new UpdateCardUseCase(repo).execute('card-1', { name: '  ' })).rejects.toBeInstanceOf(ValidationError);
    });
    it('atualiza nome e limite', async () => {
      seed(repo);
      const out = await new UpdateCardUseCase(repo).execute('card-1', { name: 'Inter', limit: 2500 });
      expect(out.name).toBe('Inter');
      expect(out.limit).toBe(2500);
    });
  });

  describe('DeleteCardUseCase', () => {
    it('lança NotFound se não existe ou já excluído', async () => {
      await expect(new DeleteCardUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
    it('lança ConflictError se existirem lançamentos vinculados', async () => {
      seed(repo);
      repo.transactionsByCard['card-1'] = 1;
      await expect(new DeleteCardUseCase(repo).execute('card-1')).rejects.toBeInstanceOf(ConflictError);
    });
    it('faz soft-delete', async () => {
      seed(repo);
      await new DeleteCardUseCase(repo).execute('card-1');
      expect(repo.items[0].deleted_at).not.toBeNull();
    });
  });

  describe('RestoreCardUseCase', () => {
    it('lança NotFound se não existe', async () => {
      await expect(new RestoreCardUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
    it('lança ValidationError se não está excluído', async () => {
      seed(repo);
      await expect(new RestoreCardUseCase(repo).execute('card-1')).rejects.toBeInstanceOf(ValidationError);
    });
    it('restaura', async () => {
      seed(repo);
      repo.items[0].deleted_at = new Date();
      const out = await new RestoreCardUseCase(repo).execute('card-1');
      expect(out.deleted_at).toBeNull();
    });
  });

  describe('GetCardByIdUseCase', () => {
    it('lança NotFound se não existe', async () => {
      await expect(new GetCardByIdUseCase(repo).execute('ghost')).rejects.toBeInstanceOf(NotFoundError);
    });
    it('retorna o cartão', async () => {
      seed(repo);
      const out = await new GetCardByIdUseCase(repo).execute('card-1');
      expect(out.name).toBe('Nubank');
    });
    it('lança ValidationError sem ID', async () => {
      await expect(new GetCardByIdUseCase(repo).execute('')).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('QuickCreateCardUseCase', () => {
    it('lança ValidationError sem nome', async () => {
      await expect(new QuickCreateCardUseCase(repo).execute({ name: '' })).rejects.toBeInstanceOf(ValidationError);
    });
    it('retorna existente quando o nome coincide (insensível a caixa)', async () => {
      seed(repo);
      const out = await new QuickCreateCardUseCase(repo).execute({ name: 'nubank' });
      expect(out.id).toBe('card-1');
    });
    it('cria novo quando não existe', async () => {
      const out = await new QuickCreateCardUseCase(repo).execute({ name: 'C6' });
      expect(out.name).toBe('C6');
      expect(out.is_active).toBe(true);
    });
  });

  describe('GetCardUsageSummaryUseCase', () => {
    it('lança ValidationError quando datas inválidas', async () => {
      const invalid = new Date('invalid');
      await expect(new GetCardUsageSummaryUseCase(repo).execute(invalid, new Date(), {})).rejects.toBeInstanceOf(ValidationError);
    });
    it('delega ao repositório', async () => {
      const out = await new GetCardUsageSummaryUseCase(repo).execute(new Date('2026-01-01'), new Date('2026-01-31'), {});
      expect(out).toEqual([]);
    });
  });

  describe('ListCardsUseCase / GetCardFiltersUseCase', () => {
    it('lista', async () => {
      seed(repo);
      const out = await new ListCardsUseCase(repo).execute({ limit: 30, page: 1, filters: {}, sortOptions: {}, includeInactive: false });
      expect(out.count).toBe(1);
    });
    it('retorna filtros', async () => {
      const out = await new GetCardFiltersUseCase(repo).execute();
      expect(out).toEqual({ filters: [] });
    });
  });
});