'use client';

import { useMemo } from 'react';
import { X } from 'lucide-react';
import type { ReportFiltersState, ReportOptions, ReportTypeFilter, ReportStatusFilter } from '../_lib/types';
import { EMPTY_FILTERS } from '../_lib/types';

interface FiltersPanelProps {
  filters: ReportFiltersState;
  onChange: (filters: ReportFiltersState) => void;
  onClose: () => void;
  options: ReportOptions;
  /** Oculta o filtro Tipo quando o relatório atual já implica Despesas ou Receitas. */
  hideTypeFilter?: boolean;
}

function toggleInArray(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function CheckboxGroup({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: { label: string; value: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div>
      {title && <p className="text-[11px] font-semibold text-content-muted uppercase tracking-wide mb-1.5">{title}</p>}
      <div className="max-h-36 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
        {options.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 text-sm text-content-secondary cursor-pointer hover:text-content">
            <input
              type="checkbox"
              checked={selected.includes(opt.value)}
              onChange={() => onToggle(opt.value)}
              className="rounded border-ui-border text-brand focus:ring-brand"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}

export default function FiltersPanel({ filters, onChange, onClose, options, hideTypeFilter }: FiltersPanelProps) {
  const set = <K extends keyof ReportFiltersState>(key: K, value: ReportFiltersState[K]) =>
    onChange({ ...filters, [key]: value });

  const visibleInstitutions = useMemo(
    () => options.institutions.filter((i) => filters.includeInactiveInstitutions || i.isActive),
    [options.institutions, filters.includeInactiveInstitutions]
  );

  const categoryOptions = useMemo(
    () => [...options.incomeCategories, ...options.expenseCategories],
    [options.incomeCategories, options.expenseCategories]
  );

  const subcategoryOptions = useMemo(() => {
    if (filters.category_id.length === 0) {
      return Object.values(options.subcategoriesByCategory).flat();
    }
    return filters.category_id.flatMap((catId) => options.subcategoriesByCategory[catId] ?? []);
  }, [filters.category_id, options.subcategoriesByCategory]);

  const incomeCenters = useMemo(() => options.centers.filter((c) => c.type === 'INCOME'), [options.centers]);
  const expenseCenters = useMemo(() => options.centers.filter((c) => c.type === 'EXPENSE'), [options.centers]);

  return (
    <div className="absolute right-0 top-full mt-2 w-[340px] bg-surface border border-ui-border-soft rounded-lg shadow-lg z-[200] flex flex-col max-h-[75vh]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-ui-border-soft shrink-0">
        <h3 className="text-sm font-semibold text-content">Filtros</h3>
        <button onClick={onClose} className="p-1 rounded-md text-content-muted hover:bg-surface-subtle hover:text-content-secondary" title="Fechar">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {!hideTypeFilter && (
          <div>
            <p className="text-[11px] font-semibold text-content-muted uppercase tracking-wide mb-1.5">Tipo</p>
            <div className="flex gap-3">
              {(['all', 'INCOME', 'EXPENSE'] as ReportTypeFilter[]).map((t) => (
                <label key={t} className="flex items-center gap-1.5 text-sm text-content-secondary cursor-pointer">
                  <input
                    type="radio"
                    name="report-type"
                    checked={filters.type === t}
                    onChange={() => set('type', t)}
                    className="text-brand focus:ring-brand"
                  />
                  {t === 'all' ? 'Todos' : t === 'INCOME' ? 'Receitas' : 'Despesas'}
                </label>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[11px] font-semibold text-content-muted uppercase tracking-wide">Instituição Financeira</p>
            <label className="flex items-center gap-1.5 text-[11px] text-content-muted cursor-pointer">
              <input
                type="checkbox"
                checked={filters.includeInactiveInstitutions}
                onChange={(e) => set('includeInactiveInstitutions', e.target.checked)}
                className="rounded border-ui-border text-brand focus:ring-brand"
              />
              Instituições inativas
            </label>
          </div>
          <div className="max-h-36 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {visibleInstitutions.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm text-content-secondary cursor-pointer hover:text-content">
                <input
                  type="checkbox"
                  checked={filters.financial_institution_id.includes(opt.value)}
                  onChange={() => set('financial_institution_id', toggleInArray(filters.financial_institution_id, opt.value))}
                  className="rounded border-ui-border text-brand focus:ring-brand"
                />
                {opt.label}
                {!opt.isActive && <span className="text-[10px] text-content-muted">(inativa)</span>}
              </label>
            ))}
          </div>
        </div>

        <CheckboxGroup
          title="Cartão"
          options={options.cards}
          selected={filters.card_id}
          onToggle={(v) => set('card_id', toggleInArray(filters.card_id, v))}
        />

        <CheckboxGroup
          title="Categoria"
          options={categoryOptions}
          selected={filters.category_id}
          onToggle={(v) => set('category_id', toggleInArray(filters.category_id, v))}
        />

        <CheckboxGroup
          title="Subcategoria"
          options={subcategoryOptions}
          selected={filters.subcategory_id}
          onToggle={(v) => set('subcategory_id', toggleInArray(filters.subcategory_id, v))}
        />

        <CheckboxGroup
          title="Centro (Receita)"
          options={incomeCenters}
          selected={filters.center_id}
          onToggle={(v) => set('center_id', toggleInArray(filters.center_id, v))}
        />

        <CheckboxGroup
          title="Centro (Despesa)"
          options={expenseCenters}
          selected={filters.center_id}
          onToggle={(v) => set('center_id', toggleInArray(filters.center_id, v))}
        />

        <div>
          <p className="text-[11px] font-semibold text-content-muted uppercase tracking-wide mb-1.5">Status</p>
          <div className="flex gap-3">
            {(['all', 'PENDING', 'COMPLETED'] as ReportStatusFilter[]).map((s) => (
              <label key={s} className="flex items-center gap-1.5 text-sm text-content-secondary cursor-pointer">
                <input
                  type="radio"
                  name="report-status"
                  checked={filters.status === s}
                  onChange={() => set('status', s)}
                  className="text-brand focus:ring-brand"
                />
                {s === 'all' ? 'Todos' : s === 'PENDING' ? 'Pendente' : 'Concluído'}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-ui-border-soft shrink-0">
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="text-xs text-content-muted hover:text-content-secondary underline"
        >
          Limpar filtros
        </button>
      </div>
    </div>
  );
}
