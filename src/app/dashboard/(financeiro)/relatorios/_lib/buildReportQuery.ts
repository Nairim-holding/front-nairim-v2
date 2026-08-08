import type { ReportFiltersState, ReportOptions, ReportRegime } from './types';

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

/** Rótulos legíveis dos filtros ativos, para o cabeçalho de impressão (Tarefa 4.3: "Filtros: ..."). */
export function describeActiveFilters(filters: ReportFiltersState, options: ReportOptions): string[] {
  const labels: string[] = [];

  if (filters.type === 'INCOME') labels.push('Tipo: Receita');
  if (filters.type === 'EXPENSE') labels.push('Tipo: Despesa');
  if (filters.status === 'PENDING') labels.push('Status: Pendente');
  if (filters.status === 'COMPLETED') labels.push('Status: Concluído');

  const nameOf = (list: { label: string; value: string }[], id: string) => list.find((o) => o.value === id)?.label ?? id;

  filters.financial_institution_id.forEach((id) => labels.push(nameOf(options.institutions, id)));
  filters.card_id.forEach((id) => labels.push(nameOf(options.cards, id)));
  filters.category_id.forEach((id) => labels.push(nameOf([...options.incomeCategories, ...options.expenseCategories], id)));
  filters.subcategory_id.forEach((id) => {
    const allSubcategories = Object.values(options.subcategoriesByCategory).flat();
    labels.push(nameOf(allSubcategories, id));
  });
  filters.center_id.forEach((id) => labels.push(nameOf(options.centers, id)));

  return labels;
}
