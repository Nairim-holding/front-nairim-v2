import 'server-only';
import { financialInstitutionUseCases } from '@/infra/factories/financial-institution-factory';
import { withTenant } from '@/infra/auth/session';
import { listFinancialInstitutionsQuerySchema } from '@/shared/validators/financial-institution';
import type {
  BalanceSummaryItem,
  FinancialInstitution,
  PaginatedFinancialInstitutions,
} from '@/core/entities/financial-institution';

/**
 * Queries (leitura) do módulo Instituições Financeiras — para Server Components.
 * Guarda: `withTenant`. Camada: server. Origem: FinancialInstitutionController (GETs).
 */

/**
 * Divide os parâmetros crus de listagem em `sortOptions` e `filters`,
 * replicando o parse do `financialIntitucion.ts` do Express.
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

export async function listFinancialInstitutionsData(raw: Record<string, unknown>): Promise<PaginatedFinancialInstitutions> {
  const { limit, page, search, includeInactive } = listFinancialInstitutionsQuerySchema.parse(raw);
  const { sortOptions, filters } = splitListParams(raw);
  return withTenant(() => financialInstitutionUseCases.list.execute({ limit, page, search, sortOptions, filters, includeInactive }));
}

export async function getFinancialInstitutionByIdData(id: string): Promise<FinancialInstitution> {
  return withTenant(() => financialInstitutionUseCases.getById.execute(id));
}

export async function getFinancialInstitutionFiltersData(): Promise<Record<string, unknown>> {
  return withTenant(() => financialInstitutionUseCases.getFilters.execute());
}

export async function getFinancialInstitutionBalanceSummaryData(): Promise<BalanceSummaryItem[]> {
  return withTenant(() => financialInstitutionUseCases.getBalanceSummary.execute());
}