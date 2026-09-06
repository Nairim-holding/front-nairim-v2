'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReferenceMonth } from '@/core/entities/lease-report';
import { currentReferenceMonth, MONTH_ABBR, monthKey, sortMonths } from '../_lib/referencePeriod';

interface MonthSelectorProps {
  selected: ReferenceMonth[];
  onChange: (months: ReferenceMonth[]) => void;
  /** Limite do schema (`leaseReportParamsSchema`) — a UI não deixa passar dele. */
  max?: number;
}

/**
 * Grade de 12 meses com navegação por ano e seleção múltipla.
 *
 * É seleção de MÊS DE REFERÊNCIA, não de intervalo de datas: o usuário pensa
 * em "o aluguel de dezembro", e o relatório é quem sabe que esse dinheiro
 * entrou em janeiro. Por isso não reaproveita o `CalendarPicker` dos
 * Relatórios Financeiros, que trabalha com from/to em dias.
 */
export default function MonthSelector({ selected, onChange, max = 36 }: MonthSelectorProps) {
  const [year, setYear] = useState(() => (selected[0]?.year ?? new Date().getFullYear()));

  const selectedKeys = useMemo(() => new Set(selected.map(monthKey)), [selected]);

  const toggle = (month: number) => {
    const candidate: ReferenceMonth = { year, month };
    const key = monthKey(candidate);
    if (selectedKeys.has(key)) {
      onChange(selected.filter((m) => monthKey(m) !== key));
      return;
    }
    if (selected.length >= max) return;
    onChange(sortMonths([...selected, candidate]));
  };

  const selectYear = () => {
    const all = Array.from({ length: 12 }, (_, i) => ({ year, month: i + 1 }));
    const remaining = selected.filter((m) => m.year !== year).slice(0, Math.max(0, max - all.length));
    onChange(sortMonths([...all, ...remaining]));
  };

  const selectCurrentMonth = () => {
    const current = currentReferenceMonth();
    setYear(current.year);
    onChange([current]);
  };

  const isYearFull = useMemo(
    () => Array.from({ length: 12 }, (_, i) => i + 1).every((month) => selectedKeys.has(monthKey({ year, month }))),
    [selectedKeys, year],
  );

  const isCurrentMonthOnly = useMemo(() => {
    if (selected.length !== 1) return false;
    return monthKey(selected[0]) === monthKey(currentReferenceMonth());
  }, [selected]);

  return (
    <div className="rounded-xl border border-ui-border-soft bg-surface p-3">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setYear((y) => y - 1)}
          className="p-1.5 rounded-lg text-content-secondary hover:bg-surface-subtle hover:text-content transition-colors"
          title="Ano anterior"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-content">{year}</span>
        <button
          type="button"
          onClick={() => setYear((y) => y + 1)}
          className="p-1.5 rounded-lg text-content-secondary hover:bg-surface-subtle hover:text-content transition-colors"
          title="Próximo ano"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {MONTH_ABBR.map((label, index) => {
          const month = index + 1;
          const isSelected = selectedKeys.has(monthKey({ year, month }));
          const isBlocked = !isSelected && selected.length >= max;
          return (
            <button
              key={label}
              type="button"
              disabled={isBlocked}
              onClick={() => toggle(month)}
              title={isBlocked ? `Máximo de ${max} meses` : undefined}
              className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isSelected
                  ? 'bg-brand/10 text-brand font-semibold border border-brand/30'
                  : isBlocked
                    ? 'text-content-muted opacity-50 cursor-not-allowed border border-transparent'
                    : 'text-content-secondary hover:bg-surface-subtle hover:text-content border border-transparent'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 pt-2 border-t border-ui-border-soft text-[11px] space-y-2">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={selectYear}
            disabled={isYearFull}
            className="text-brand hover:underline font-medium disabled:text-content-muted disabled:no-underline disabled:cursor-default"
          >
            {isYearFull ? 'Ano todo selecionado' : 'Selecionar o ano todo'}
          </button>
          <button
            type="button"
            onClick={selectCurrentMonth}
            disabled={isCurrentMonthOnly}
            className="text-brand hover:underline font-medium disabled:text-content-muted disabled:no-underline disabled:cursor-default"
          >
            Voltar ao mês atual
          </button>
        </div>
        <span className="text-content-muted">
          {selected.length} {selected.length === 1 ? 'mês' : 'meses'}
        </span>
      </div>
    </div>
  );
}
