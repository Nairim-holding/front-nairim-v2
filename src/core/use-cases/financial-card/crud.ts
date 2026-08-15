import type { CardsRepository } from '@/core/repositories/financial-cards-repository';
import type {
  Card,
  CardUsageFilters,
  CardUsageItem,
  CreateCardData,
  ListCardsParams,
  PaginatedCards,
  UpdateCardData,
} from '@/core/entities/financial-card';
import { ConflictError, NotFoundError, ValidationError } from '@/core/errors/domain-errors';

/**
 * Casos de uso de Cartão Financeiro.
 * Camada: core.
 * Origem: api-nairim-v2/src/services/CardService.ts + CardController.
 * Rodam dentro do contexto de tenant (withTenant).
 *
 * FIDELIDADE: mensagens e status replicam o backend — `Cartão não encontrado`
 * (404), delete com lançamentos vinculados (409), restore valida exclusão.
 */

function isDiaValido(day: number | null | undefined): boolean {
  return day == null || (!isNaN(Number(day)) && Number(day) >= 1 && Number(day) <= 31);
}

function isLimitValido(limit: number | null | undefined): boolean {
  return limit === undefined || limit === null || !isNaN(Number(limit));
}

export class ListCardsUseCase {
  constructor(private readonly cards: CardsRepository) {}
  async execute(params: ListCardsParams): Promise<PaginatedCards> {
    return this.cards.list(params);
  }
}

export class GetCardFiltersUseCase {
  constructor(private readonly cards: CardsRepository) {}
  async execute(): Promise<Record<string, unknown>> {
    return this.cards.getFilters();
  }
}

export class GetCardByIdUseCase {
  constructor(private readonly cards: CardsRepository) {}
  async execute(id: string): Promise<Card> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    const card = await this.cards.findById(id);
    if (!card) throw new NotFoundError('Cartão não encontrado');
    return card;
  }
}

export class CreateCardUseCase {
  constructor(private readonly cards: CardsRepository) {}
  async execute(data: CreateCardData): Promise<Card> {
    if (!data.name?.trim()) throw new ValidationError('O nome do cartão é obrigatório');
    if (!isLimitValido(data.limit)) throw new ValidationError('O limite deve ser um valor numérico');
    if (!isDiaValido(data.closing_day)) throw new ValidationError('O dia de fechamento deve ser entre 1 e 31');
    if (!isDiaValido(data.due_day)) throw new ValidationError('O dia de vencimento deve ser entre 1 e 31');
    return this.cards.create(data);
  }
}

export class UpdateCardUseCase {
  constructor(private readonly cards: CardsRepository) {}
  async execute(id: string, data: UpdateCardData): Promise<Card> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    if (data.name !== undefined && !data.name?.trim()) throw new ValidationError('O nome do cartão não pode ser vazio');
    if (!isLimitValido(data.limit)) throw new ValidationError('O limite deve ser um valor numérico');
    if (!isDiaValido(data.closing_day)) throw new ValidationError('O dia de fechamento deve ser entre 1 e 31');
    if (!isDiaValido(data.due_day)) throw new ValidationError('O dia de vencimento deve ser entre 1 e 31');
    const existing = await this.cards.findById(id);
    if (!existing) throw new NotFoundError('Cartão não encontrado');
    return this.cards.update(id, data);
  }
}

export class DeleteCardUseCase {
  constructor(private readonly cards: CardsRepository) {}
  async execute(id: string): Promise<void> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    await this.cards.softDelete(id);
  }
}

export class RestoreCardUseCase {
  constructor(private readonly cards: CardsRepository) {}
  async execute(id: string): Promise<Card> {
    if (!id) throw new ValidationError('O ID é obrigatório');
    const state = await this.cards.findDeletionState(id);
    if (!state) throw new NotFoundError('Cartão não encontrado');
    if (!state.deleted_at) throw new ValidationError('Cartão não está excluído');
    return this.cards.restore(id);
  }
}

export class QuickCreateCardUseCase {
  constructor(private readonly cards: CardsRepository) {}
  async execute(data: { name: string }): Promise<Card> {
    if (!data.name?.trim()) throw new ValidationError('Nome é obrigatório');
    return this.cards.quickCreate(data);
  }
}

export class GetCardUsageSummaryUseCase {
  constructor(private readonly cards: CardsRepository) {}
  async execute(startDate: Date, endDate: Date, filters: CardUsageFilters): Promise<CardUsageItem[]> {
    if (!startDate || isNaN(startDate.getTime()) || !endDate || isNaN(endDate.getTime())) {
      throw new ValidationError('startDate e endDate são obrigatórios');
    }
    return this.cards.getUsageSummary(startDate, endDate, filters);
  }
}