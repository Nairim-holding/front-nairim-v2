'use client';

import { useMemo } from 'react';
import {
  X, Check, Landmark, CreditCard, Tag, Tags, ArrowDownCircle, ArrowUpCircle,
  ListFilter, CircleDot,
} from 'lucide-react';
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

/** Cabeçalho de seção padrão: ícone + título + contador de selecionados. */
function SectionHeader({ icon, title, count }: { icon: React.ReactNode; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-content-muted">{icon}</span>
      <p className="text-sm font-semibold text-content">{title}</p>
      {Boolean(count) && (
        <span className="ml-auto text-[11px] font-semibold text-brand bg-brand/10 rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
          {count}
        </span>
      )}
    </div>
  );
}

/** Moldura de cartão comum a toda seção do filtro — mesma altura de título e
 * mesma "caixa" cinza para dar consistência visual entre listas e radios. */
function FilterCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 bg-surface-subtle/60 border border-ui-border-soft rounded-xl p-3">
      {children}
    </div>
  );
}

function CheckboxGroup({
  icon,
  title,
  options,
  selected,
  onToggle,
}: {
  icon: React.ReactNode;
  title: string;
  options: { label: string; value: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <FilterCard>
      <SectionHeader icon={icon} title={title} count={selected.length} />
      <div className="max-h-40 overflow-y-auto space-y-0.5 pr-1 custom-scrollbar">
        {options.map((opt) => {
          const isChecked = selected.includes(opt.value);
          return (
            <label
              key={opt.value}
              className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                isChecked ? 'bg-brand/10 text-content' : 'text-content-secondary hover:bg-surface-subtle'
              }`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onToggle(opt.value)}
                className="rounded border-ui-border text-brand focus:ring-brand focus:ring-offset-0"
              />
              <span className="truncate">{opt.label}</span>
            </label>
          );
        })}
      </div>
    </FilterCard>
  );
}

function RadioRow<T extends string>({
  icon,
  title,
  name,
  value,
  onChange,
  options,
}: {
  icon: React.ReactNode;
  title: string;
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <FilterCard>
      <SectionHeader icon={icon} title={title} />
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const isActive = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                isActive
                  ? 'bg-brand text-content-inverse border-brand'
                  : 'bg-surface border-ui-border text-content-secondary hover:bg-surface-subtle'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </FilterCard>
  );
}

/**
 * Mesma "casca" visual do DynamicFilterModal (padrão usado em Lançamentos e no
 * Resumo Financeiro): overlay + modal centralizado largo, grade horizontal de
 * seções, botões "Limpar tudo"/fechar no rodapé — antes este painel era um
 * dropdown estreito ancorado à direita, com scroll vertical só dele, fora do
 * padrão das demais telas. Cada seção agora vive num cartão com ícone e
 * contador de selecionados, para separar visualmente os grupos.
 */
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

  const activeFilterCount =
    filters.financial_institution_id.length +
    filters.card_id.length +
    filters.category_id.length +
    filters.subcategory_id.length +
    filters.center_id.length +
    (filters.type !== 'all' ? 1 : 0) +
    (filters.status !== 'all' ? 1 : 0);

  return (
    <>
      <div className="fixed inset-0 z-[9990] bg-black/50" onClick={onClose} />

      <div
        className="fixed top-[5%] left-1/2 -translate-x-1/2 z-[9995] bg-surface rounded-xl shadow-2xl border border-ui-border-soft flex flex-col"
        style={{ width: 'min(90vw, 1400px)', maxHeight: '85vh' }}
      >
        <div className="p-4 flex justify-between items-center border-b border-ui-border-soft shrink-0 bg-surface">
          <div>
            <h3 className="text-lg font-semibold text-content">Filtrar Relatório</h3>
            <p className="text-sm text-content-muted mt-1">
              {activeFilterCount > 0 ? `${activeFilterCount} filtro(s) ativo(s)` : 'Selecione os critérios de filtro'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-surface-subtle rounded-lg transition-colors flex-shrink-0" aria-label="Fechar filtro">
            <X size={20} className="text-content-secondary" />
          </button>
        </div>

        <div className="p-4 grid gap-3 flex-1 min-h-0 overflow-y-auto grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 custom-scrollbar">
          {!hideTypeFilter && (
            <RadioRow
              icon={<ListFilter size={16} />}
              title="Tipo"
              name="report-type"
              value={filters.type}
              onChange={(v: ReportTypeFilter) => set('type', v)}
              options={[
                { value: 'all', label: 'Todos' },
                { value: 'INCOME', label: 'Receitas' },
                { value: 'EXPENSE', label: 'Despesas' },
              ]}
            />
          )}

          <FilterCard>
            <SectionHeader icon={<Landmark size={16} />} title="Instituição Financeira" count={filters.financial_institution_id.length} />
            <label className="flex items-center gap-1.5 text-xs text-content-muted cursor-pointer -mt-1">
              <input
                type="checkbox"
                checked={filters.includeInactiveInstitutions}
                onChange={(e) => set('includeInactiveInstitutions', e.target.checked)}
                className="rounded border-ui-border text-brand focus:ring-brand focus:ring-offset-0"
              />
              Incluir instituições inativas
            </label>
            <div className="max-h-40 overflow-y-auto space-y-0.5 pr-1 custom-scrollbar">
              {visibleInstitutions.map((opt) => {
                const isChecked = filters.financial_institution_id.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                      isChecked ? 'bg-brand/10 text-content' : 'text-content-secondary hover:bg-surface-subtle'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => set('financial_institution_id', toggleInArray(filters.financial_institution_id, opt.value))}
                      className="rounded border-ui-border text-brand focus:ring-brand focus:ring-offset-0"
                    />
                    <span className="truncate">{opt.label}</span>
                    {!opt.isActive && <span className="text-[10px] text-content-muted shrink-0">(inativa)</span>}
                  </label>
                );
              })}
            </div>
          </FilterCard>

          <CheckboxGroup
            icon={<CreditCard size={16} />}
            title="Cartão"
            options={options.cards}
            selected={filters.card_id}
            onToggle={(v) => set('card_id', toggleInArray(filters.card_id, v))}
          />

          <CheckboxGroup
            icon={<Tag size={16} />}
            title="Categoria"
            options={categoryOptions}
            selected={filters.category_id}
            onToggle={(v) => set('category_id', toggleInArray(filters.category_id, v))}
          />

          <CheckboxGroup
            icon={<Tags size={16} />}
            title="Subcategoria"
            options={subcategoryOptions}
            selected={filters.subcategory_id}
            onToggle={(v) => set('subcategory_id', toggleInArray(filters.subcategory_id, v))}
          />

          <CheckboxGroup
            icon={<ArrowUpCircle size={16} className="text-state-success" />}
            title="Centro (Receita)"
            options={incomeCenters}
            selected={filters.center_id}
            onToggle={(v) => set('center_id', toggleInArray(filters.center_id, v))}
          />

          <CheckboxGroup
            icon={<ArrowDownCircle size={16} className="text-state-warning" />}
            title="Centro (Despesa)"
            options={expenseCenters}
            selected={filters.center_id}
            onToggle={(v) => set('center_id', toggleInArray(filters.center_id, v))}
          />

          <RadioRow
            icon={<CircleDot size={16} />}
            title="Status"
            name="report-status"
            value={filters.status}
            onChange={(v: ReportStatusFilter) => set('status', v)}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'PENDING', label: 'Pendente' },
              { value: 'COMPLETED', label: 'Concluído' },
            ]}
          />
        </div>

        <div className="p-4 flex items-center justify-between gap-3 border-t border-ui-border-soft shrink-0 bg-surface">
          <span className="text-xs text-content-muted">
            {activeFilterCount > 0 ? `${activeFilterCount} filtro(s) selecionado(s)` : 'Nenhum filtro selecionado'}
          </span>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onChange(EMPTY_FILTERS)}
              className="px-4 py-2 border border-ui-border rounded-lg text-sm font-medium hover:bg-surface-subtle transition-colors"
            >
              Limpar tudo
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gradient-to-r from-brand to-brand-hover text-content-inverse rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              <Check size={16} />
              Aplicar filtros
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
