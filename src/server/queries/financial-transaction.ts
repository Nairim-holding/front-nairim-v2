import 'server-only';
import { financialTransactionUseCases } from '@/infra/factories/financial-transaction-factory';
import { withPermission } from '@/infra/auth/session';
import { listFinancialTransactionsQuerySchema } from '@/shared/validators/financial-transaction';
import type {
  PaginatedTransactions,
  Transaction,
  TransactionFiltersResult,
} from '@/core/entities/financial-transaction';

/**
 * Queries (leitura) do módulo Lançamentos — para Server Components.
 * Guarda: `withTenant`. Camada: server. Origem: TransactionController (GETs).
 */
function splitListParams(raw: Record<string, unknown>) {
  const sortOptions: Record<string, string> = {};
  const filters: Record<string, unknown> = {};

  const parseValue = (value: unknown): unknown => {
    if (typeof value !== 'string') return value;
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) || (parsed && typeof parsed === 'object') ? parsed : value;
    } catch {
      return value;
    }
  };

  Object.entries(raw ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    const sortMatch = key.match(/^sort\[(.+)\]$/);
    if (sortMatch) {
      const dir = String(value).toLowerCase();
      if (dir === 'asc' || dir === 'desc') sortOptions[sortMatch[1]] = dir;
      return;
    }
    if (['limit', 'page', 'search', 'includeInactive'].includes(key)) return;

    const filterMatch = key.match(/^filter\[(.+)\]$/);
    if (filterMatch) {
      filters[filterMatch[1]] = parseValue(value);
    } else {
      filters[key] = parseValue(value);
    }
  });

  return { sortOptions, filters };
}

export async function listFinancialTransactionsData(
  raw: Record<string, unknown>,
): Promise<PaginatedTransactions> {
  const { limit, page, search, includeInactive } = listFinancialTransactionsQuerySchema.parse(raw);
  const { sortOptions, filters } = splitListParams(raw);
  return withPermission('financial-transactions', 'view', () =>
    financialTransactionUseCases.list.execute({ limit, page, search, sortOptions, filters, includeInactive }),
  );
}

export async function getTransactionByIdData(id: string): Promise<Transaction> {
  return withPermission('financial-transactions', 'view', () => financialTransactionUseCases.getById.execute(id));
}

export async function getTransactionFiltersData(raw: Record<string, unknown>): Promise<TransactionFiltersResult> {
  return withPermission('financial-transactions', 'view', () => financialTransactionUseCases.getFilters.execute(raw));
}

export async function getRelatedTransactionsData(id: string) {
  return withPermission('financial-transactions', 'view', () => financialTransactionUseCases.getRelated.execute(id));
}
