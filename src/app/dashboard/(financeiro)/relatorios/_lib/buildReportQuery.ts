import type { ReportFiltersState, ReportRegime } from './types';

/** Monta a querystring comum aos endpoints /financial-reports/*, seguindo o padrão filter[campo] (multi-seleção = chave repetida). */
export function buildReportQuery(params: {
  from: string;
  to: string;
  regime: ReportRegime;
  filters: ReportFiltersState;
  /** Força o type (usado pelos itens de menu Despesas/Receitas, que já implicam o tipo). */
  typeOverride?: 'INCOME' | 'EXPENSE';
}): URLSearchParams {
  const qs = new URLSearchParams();
  qs.set('startDate', params.from);
  qs.set('endDate', params.to);
  qs.set('regime', params.regime);

  const effectiveType = params.typeOverride ?? (params.filters.type !== 'all' ? params.filters.type : undefined);
  if (effectiveType) qs.set('type', effectiveType);

  if (params.filters.status !== 'all') qs.set('status', params.filters.status);

  const appendMulti = (field: string, values: string[]) => {
    values.forEach((v) => qs.append(`filter[${field}]`, v));
  };
  appendMulti('financial_institution_id', params.filters.financial_institution_id);
  appendMulti('card_id', params.filters.card_id);
  appendMulti('category_id', params.filters.category_id);
  appendMulti('subcategory_id', params.filters.subcategory_id);
  appendMulti('center_id', params.filters.center_id);

  return qs;
}

export function countActiveFilters(filters: ReportFiltersState): number {
  let count = 0;
  if (filters.type !== 'all') count += 1;
  if (filters.status !== 'all') count += 1;
  if (filters.includeInactiveInstitutions) count += 1;
  count += filters.financial_institution_id.length;
  count += filters.card_id.length;
  count += filters.category_id.length;
  count += filters.subcategory_id.length;
  count += filters.center_id.length;
  return count;
}
