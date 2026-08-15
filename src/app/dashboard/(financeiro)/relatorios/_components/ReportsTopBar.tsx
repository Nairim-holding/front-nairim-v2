'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Filter, Printer, FileSpreadsheet, FileText, X } from 'lucide-react';
import CalendarPicker from '@/components/ui/CalendarPicker';
import FiltersPanel from './FiltersPanel';
import { buildDateShortcuts, formatDateDisplay, getClearedDateRange } from '../_lib/dateShortcuts';
import { countActiveFilters } from '../_lib/buildReportQuery';
import type { ReportFiltersState, ReportKind, ReportOptions, ReportRegime } from '../_lib/types';

interface ReportsTopBarProps {
  dateRange: { from: string; to: string };
  onDateRangeChange: (range: { from: string; to: string }) => void;
  reportKind: ReportKind;
  onReportKindChange: (kind: ReportKind) => void;
  regime: ReportRegime;
  onRegimeChange: (regime: ReportRegime) => void;
  filters: ReportFiltersState;
  onFiltersChange: (filters: ReportFiltersState) => void;
  options: ReportOptions;
  hideTypeFilter: boolean;
  onPrint: () => void;
  onExportExcel: () => void;
  onExportPDF: () => void;
  canExport: boolean;
}

export default function ReportsTopBar({
  dateRange,
  onDateRangeChange,
  reportKind,
  onReportKindChange,
  regime,
  onRegimeChange,
  filters,
  onFiltersChange,
  options,
  hideTypeFilter,
  onPrint,
  onExportExcel,
  onExportPDF,
  canExport,
}: ReportsTopBarProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  const shortcuts = useMemo(() => buildDateShortcuts(), []);
  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) setIsCalendarOpen(false);
    };
    if (isCalendarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isCalendarOpen]);

  // FiltersPanel agora é um modal centralizado com overlay próprio (mesma casca
  // do DynamicFilterModal) — o overlay já fecha ao clicar fora, sem precisar de
  // um listener de "clique fora" aqui (que fechava a cada clique dentro do
  // próprio painel, já que ele deixou de estar aninhado neste wrapper).
  const isShortcutActive = (from: string, to: string) => dateRange.from === from && dateRange.to === to;

  // Tarefa 4.2: os endpoints de relatório exigem startDate/endDate (ver
  // dateShortcuts.ts), então "Limpar" não pode esvaziar o período como em
  // Lançamentos — usa o maior intervalo aceito pela API. Para o botão ainda
  // *parecer* limpo (como em Lançamentos), exibe o rótulo genérico "Período"
  // sempre que o intervalo atual for exatamente esse "todo o histórico".
  const clearedRange = useMemo(() => getClearedDateRange(), []);
  const isCleared = isShortcutActive(clearedRange.from, clearedRange.to);

  return (
    <div className="border-b border-ui-border-soft bg-surface shrink-0">
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
        <div className="flex flex-wrap gap-1.5">
          {shortcuts.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => onDateRangeChange({ from: s.from, to: s.to })}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                isShortcutActive(s.from, s.to)
                  ? 'bg-brand text-content-inverse border-brand'
                  : 'bg-surface border-ui-border text-content-secondary hover:bg-surface-subtle'
              }`}
            >
              {s.label}
            </button>
          ))}
          {/* Tarefa 4.2: considera todo o histórico de lançamentos, sem recorte de período. */}
          <button
            type="button"
            onClick={() => onDateRangeChange(getClearedDateRange())}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border border-ui-border text-content-secondary bg-surface hover:bg-surface-subtle transition-colors"
            title="Considerar todo o período de lançamentos"
          >
            <X size={12} />
            Limpar
          </button>
        </div>

        <div className="relative" ref={calendarRef}>
          <button
            type="button"
            onClick={() => setIsCalendarOpen((o) => !o)}
            className="flex items-center gap-2 border border-ui-border rounded-lg px-3 py-1.5 text-xs text-content bg-surface hover:bg-surface-subtle focus:outline-none focus:border-brand transition-colors"
          >
            <Calendar size={14} className="text-content-secondary" />
            <span className={`font-medium whitespace-nowrap ${isCleared ? 'text-content-muted' : ''}`}>
              {isCleared ? 'Período' : `${formatDateDisplay(dateRange.from)} — ${formatDateDisplay(dateRange.to)}`}
            </span>
          </button>
          {isCalendarOpen && (
            <div className="absolute top-full left-0 mt-2 bg-surface border border-ui-border-soft rounded-lg shadow-lg z-[200] p-4">
              <CalendarPicker
                dateRange={dateRange}
                onChange={(range) => {
                  onDateRangeChange(range);
                  setIsCalendarOpen(false);
                }}
              />
            </div>
          )}
        </div>

        <div className="relative ml-auto">
          <button
            type="button"
            onClick={() => setIsFiltersOpen((o) => !o)}
            className="relative flex items-center gap-2 border border-ui-border rounded-lg px-3 py-1.5 text-xs font-medium text-content-secondary bg-surface hover:bg-surface-subtle transition-colors"
          >
            <Filter size={14} />
            Filtros
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-brand text-content-inverse text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
          {isFiltersOpen && (
            <FiltersPanel
              filters={filters}
              onChange={onFiltersChange}
              onClose={() => setIsFiltersOpen(false)}
              options={options}
              hideTypeFilter={hideTypeFilter}
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 px-4 pb-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-content-muted">Tipo de Relatório:</span>
          <div className="flex rounded-md border border-ui-border overflow-hidden">
            {(['sintetico', 'analitico'] as ReportKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => onReportKindChange(k)}
                className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                  reportKind === k ? 'bg-brand text-content-inverse' : 'bg-surface text-content-secondary hover:bg-surface-subtle'
                }`}
              >
                {k === 'sintetico' ? 'Sintético' : 'Analítico'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-content-muted">Regime:</span>
          <div className="flex rounded-md border border-ui-border overflow-hidden">
            {(['caixa', 'competencia'] as ReportRegime[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onRegimeChange(r)}
                className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                  regime === r ? 'bg-brand text-content-inverse' : 'bg-surface text-content-secondary hover:bg-surface-subtle'
                }`}
              >
                {r === 'caixa' ? 'Caixa' : 'Competência'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <button
            type="button"
            onClick={onPrint}
            disabled={!canExport}
            title="Imprimir"
            className="p-1.5 rounded-lg border border-ui-border text-content-muted hover:text-content hover:bg-surface-subtle disabled:opacity-40 transition-colors"
          >
            <Printer size={15} />
          </button>
          <button
            type="button"
            onClick={onExportExcel}
            disabled={!canExport}
            title="Exportar Excel"
            className="p-1.5 rounded-lg border border-ui-border text-content-muted hover:text-content hover:bg-surface-subtle disabled:opacity-40 transition-colors"
          >
            <FileSpreadsheet size={15} />
          </button>
          <button
            type="button"
            onClick={onExportPDF}
            disabled={!canExport}
            title="Exportar PDF"
            className="p-1.5 rounded-lg border border-ui-border text-content-muted hover:text-content hover:bg-surface-subtle disabled:opacity-40 transition-colors"
          >
            <FileText size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
