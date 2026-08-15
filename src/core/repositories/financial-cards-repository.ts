import type {
  Card,
  CardUsageFilters,
  CardUsageItem,
  CreateCardData,
  ListCardsParams,
  PaginatedCards,
  UpdateCardData,
} from '@/core/entities/financial-card';

/**
 * Contrato de acesso a dados de Cartão Financeiro.
 * Implementação Prisma: infra/repositories/prisma-financial-cards-repository.ts.
 * Tenant-scoped (empresa): roda dentro de `withTenant`.
 *
 * Camada: core.
 * Origem: `prisma.card.*` em api-nairim-v2/src/services/CardService.ts.
 */
export interface CardsRepository {
  list(params: ListCardsParams): Promise<PaginatedCards>;
  getFilters(): Promise<Record<string, unknown>>;
  /** Cartão por ID (não excluído). */
  findById(id: string): Promise<Card | null>;
  create(data: CreateCardData): Promise<Card>;
  update(id: string, data: UpdateCardData): Promise<Card>;
  /**
   * Soft-delete. Lança conflito (409) se existirem transações não-excluídas
   * vinculadas (mensagem exata preservada do backend).
   */
  softDelete(id: string): Promise<Card>;
  /** Estado de exclusão (para restore validar). */
  findDeletionState(id: string): Promise<{ id: string; deleted_at: Date | null } | null>;
  restore(id: string): Promise<Card>;
  /** find-or-create insensível a maiúsculas pelo nome. */
  quickCreate(data: { name: string }): Promise<Card>;
  /** Resumo de uso: despesas não-transfer por cartão no período + filtros. */
  getUsageSummary(startDate: Date, endDate: Date, filters: CardUsageFilters): Promise<CardUsageItem[]>;
}