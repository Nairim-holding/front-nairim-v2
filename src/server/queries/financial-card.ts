import 'server-only';
import { financialCardUseCases } from '@/infra/factories/financial-card-factory';
import { withPermission } from '@/infra/auth/session';
import { listFinancialCardsQuerySchema } from '@/shared/validators/financial-card';
import type { Card, CardUsageFilters, CardUsageItem, PaginatedCards } from '@/core/entities/financial-card';

/**
 * Queries (leitura) do módulo Cartões Financeiros — para Server Components.
 * Guarda: `withTenant`. Camada: server. Origem: CardController (GETs).
 */
function splitListParams(raw: Record<string, unknown>) {
  const sortOptions: Record<string, string> = {};
  const filters: Record<string, unknown> = {};

  Object.entries(raw ?? {}).forEach(([key, value]) => {
    if (typeof value !== 'string') return;
    const sortMatch = key.match(/^sort\[(.+)\]$/);
    if (sortMatch) {
      const dir = value.toLowerCase();
      if (dir === 'asc' || dir === 'desc') sortOptions[sortMatch[1]] = dir;
      return;
    }
    if (['limit', 'page', 'search', 'includeInactive'].includes(key) || value.trim() === '') return;

    const filterMatch = key.match(/^filter\[(.+)\]$/);
    if (filterMatch) {
      filters[filterMatch[1]] = value;
    } else if (key !== 'sort' && !key.startsWith('sort[')) {
      try {
        filters[key] = JSON.parse(value);
      } catch {
        filters[key] = value;
      }
    }
  });

  return { sortOptions, filters };
}

export async function listFinancialCardsData(raw: Record<string, unknown>): Promise<PaginatedCards> {
  const { limit, page, search, includeInactive } = listFinancialCardsQuerySchema.parse(raw);
  const { sortOptions, filters } = splitListParams(raw);
  return withPermission('financial-cards', 'view', () =>
    financialCardUseCases.list.execute({ limit, page, search, sortOptions, filters, includeInactive }),
  );
}

export async function getCardByIdData(id: string): Promise<Card> {
  return withPermission('financial-cards', 'view', () => financialCardUseCases.getById.execute(id));
}

export async function getCardFiltersData(raw: Record<string, unknown>): Promise<Record<string, unknown>> {
  void raw;
  return withPermission('financial-cards', 'view', () => financialCardUseCases.getFilters.execute());
}

export async function getCardUsageSummaryData(
  startDate: Date,
  endDate: Date,
  filters: CardUsageFilters,
): Promise<CardUsageItem[]> {
  return withPermission('financial-cards', 'view', () => financialCardUseCases.getUsageSummary.execute(startDate, endDate, filters));
}
