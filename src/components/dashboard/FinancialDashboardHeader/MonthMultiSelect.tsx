'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

interface MonthMultiSelectProps {
  selectedMonths: number[];
  onChange: (months: number[]) => void;
}

/**
 * Seletor de meses com múltipla seleção. Sem borda/fundo próprios: é o
 * segundo segmento do pill "Período de análise" (junto com YearSelect), que
 * fornece o contorno compartilhado — dá a sensação de um único controle.
 */
export default function MonthMultiSelect({ selectedMonths, onChange }: MonthMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMonth = (month: number) => {
    if (selectedMonths.includes(month)) {
      if (selectedMonths.length === 1) return; // mantém ao menos 1 mês selecionado
      onChange(selectedMonths.filter((m) => m !== month).sort((a, b) => a - b));
    } else {
      onChange([...selectedMonths, month].sort((a, b) => a - b));
    }
  };

  const selectAllMonths = () => {
    onChange(Array.from({ length: 12 }, (_, i) => i + 1));
    setIsOpen(false);
  };

  // Tarefa 6.2 (29/07/26): com o ano inteiro já marcado, o botão vira um
  // toggle — "Selecionar mês corrente" deixa marcado só o mês atual.
  const selectCurrentMonth = () => {
    onChange([new Date().getMonth() + 1]);
    setIsOpen(false);
  };

  const isFullYear = selectedMonths.length === 12;

  const label = selectedMonths.length === 12
    ? 'Ano inteiro'
    : selectedMonths.length === 1
      ? MONTH_LABELS[selectedMonths[0] - 1]
      : `${selectedMonths.length} meses`;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={`flex items-center gap-1.5 h-[40px] pl-3 pr-3.5 text-[14px] font-medium rounded-r-xl outline-none transition-colors cursor-pointer max-w-[160px] ${
          isOpen ? 'bg-surface-subtle text-brand' : 'text-content-secondary hover:bg-surface-subtle'
        }`}
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={15} className={`shrink-0 text-content-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1.5 left-0 bg-surface border border-ui-border-soft rounded-xl shadow-lg p-2 w-[236px] max-w-[calc(100vw-2rem)] animate-in fade-in zoom-in-95 duration-150">
          <div className="grid grid-cols-3 gap-1 mb-1.5">
            {MONTH_LABELS.map((monthLabel, idx) => {
              const month = idx + 1;
              const checked = selectedMonths.includes(month);
              return (
                <button
                  key={month}
                  type="button"
                  onClick={() => toggleMonth(month)}
                  className={`flex items-center justify-between gap-1 pl-2.5 pr-2 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                    checked ? 'bg-brand/10 text-brand font-semibold' : 'text-content-secondary hover:bg-surface-subtle'
                  }`}
                >
                  {monthLabel}
                  {checked && <Check size={13} className="shrink-0" />}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={isFullYear ? selectCurrentMonth : selectAllMonths}
            className="w-full text-center text-xs font-medium text-content-muted hover:text-brand py-1.5 border-t border-ui-border-soft transition-colors cursor-pointer"
          >
            {isFullYear ? 'Selecionar mês corrente' : 'Selecionar ano inteiro'}
          </button>
        </div>
      )}
    </div>
  );
}
