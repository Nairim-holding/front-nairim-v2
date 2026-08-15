/**
 * Entidades de domínio: Cartão financeiro (Card).
 *
 * Fidelidade ao backend: `getCards` no Express NÃO recebe `company_id` (leitura
 * sem escopo de empresa); na migração `Card` está em TENANT_MODELS e a extensão
 * multi-tenant injeta `company_id` nas leituras (comportamento escopado,
 * consistente com o menu financeiro — divergência documentada, igual à de
 * Subcategory). `getCardUsageSummary` soma despesas de transações não-transfer
 * por cartão no período (mesa de resumo de uso).
 *
 * Camada: core.
 * Origem: model `Card` (prisma/schema.prisma) e
 * api-nairim-v2/src/services/CardService.ts.
 */

export interface Card {
  id: string;
  company_id: string;
  name: string;
  /** Decimal serializado; usar Number() para cálculos. */
  limit: unknown;
  is_active: boolean;
  closing_day: number | null;
  due_day: number | null;
  brand: string;
  current_balance: unknown;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface CreateCardData {
  name: string;
  limit?: number | null;
  closing_day?: number | null;
  due_day?: number | null;
  is_active?: boolean;
}

export interface UpdateCardData {
  name?: string;
  limit?: number | null;
  closing_day?: number | null;
  due_day?: number | null;
  is_active?: boolean;
}

export interface ListCardsParams {
  limit: number;
  page: number;
  search?: string;
  filters: Record<string, unknown>;
  sortOptions: Record<string, string>;
  includeInactive: boolean;
}

export interface PaginatedCards {
  data: Card[];
  count: number;
  totalPages: number;
  currentPage: number;
}

/** Item do resumo de uso de cartões (por período + filtros opcionais). */
export interface CardUsageItem {
  cardId: string;
  name: string;
  limit: number;
  consumed: number;
}

/** Filtros opcionais do resumo de uso — chave repetida = seleção múltipla. */
export interface CardUsageFilters {
  category_id?: string[];
  subcategory_id?: string[];
  financial_institution_id?: string[];
  card_id?: string[];
  center_id?: string[];
  supplier_id?: string[];
  description?: string[];
}