'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useAvailableYears } from '@/hooks/useAvailableYears';

interface YearSelectProps {
  value: number;
  onChange: (year: number) => void;
}

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

/**
 * Seletor de ano combobox: sugere os anos com lançamentos cadastrados (via
 * useAvailableYears) e também aceita digitação livre de qualquer ano dentro
 * de um intervalo razoável — útil para quem quer planejar um ano futuro
 * ainda sem lançamentos, por exemplo.
 *
 * Sem borda/fundo próprios: é o primeiro segmento do pill "Período de
 * análise" (junto com MonthMultiSelect), que fornece o contorno
 * compartilhado — dá a sensação de um único controle, não dois campos soltos.
 */
export default function YearSelect({ value, onChange }: YearSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { years: registeredYears, isLoading } = useAvailableYears();

  const currentYear = new Date().getFullYear();
  const fallbackYears = useMemo(
    () => Array.from({ length: 4 }, (_, i) => currentYear - 2 + i),
    [currentYear]
  );

  // Sugestões: anos com lançamentos + o ano atualmente selecionado (mesmo
  // que ainda sem lançamentos), sem duplicar, do mais recente ao mais antigo.
  const suggestions = useMemo(() => {
    const base = registeredYears.length > 0 ? registeredYears : fallbackYears;
    const withCurrent = base.includes(value) ? base : [...base, value];
    return Array.from(new Set(withCurrent)).sort((a, b) => b - a);
  }, [registeredYears, fallbackYears, value]);

  const filtered = useMemo(() => {
    if (!query.trim()) return suggestions;
    return suggestions.filter((y) => String(y).includes(query.trim()));
  }, [suggestions, query]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const commitYear = (year: number) => {
    if (Number.isFinite(year) && year >= MIN_YEAR && year <= MAX_YEAR) {
      onChange(year);
    }
    setIsOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered.length > 0) {
        commitYear(filtered[0]);
      } else {
        const typed = Number(query.trim());
        if (typed) commitYear(typed);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setQuery('');
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={`flex items-center gap-1.5 h-[40px] px-3.5 text-[14px] font-medium rounded-l-xl outline-none transition-colors cursor-pointer ${
          isOpen ? 'bg-surface-subtle text-brand' : 'text-content-secondary hover:bg-surface-subtle'
        }`}
      >
        <span>{value}</span>
        <ChevronDown size={15} className={`shrink-0 text-content-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1.5 left-0 bg-surface border border-ui-border-soft rounded-xl shadow-lg p-1.5 w-[140px] animate-in fade-in zoom-in-95 duration-150">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={query}
            onChange={(e) => setQuery(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
            onKeyDown={handleKeyDown}
            placeholder="Digite o ano"
            className="w-full text-sm px-2.5 py-1.5 mb-1.5 rounded-lg border border-ui-border-soft bg-surface outline-none focus:border-brand text-content-secondary placeholder:text-content-placeholder"
          />

          <div className="max-h-[180px] overflow-y-auto">
            {isLoading && (
              <div className="px-2.5 py-1.5 text-xs text-content-muted">Carregando anos...</div>
            )}

            {!isLoading && filtered.length === 0 && (
              <div className="px-2.5 py-1.5 text-xs text-content-muted">
                Pressione Enter para usar &quot;{query}&quot;
              </div>
            )}

            {filtered.map((y) => {
              const selected = y === value;
              const hasData = registeredYears.includes(y);
              return (
                <button
                  key={y}
                  type="button"
                  onClick={() => commitYear(y)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                    selected ? 'bg-brand/10 text-brand font-semibold' : 'text-content-secondary hover:bg-surface-subtle'
                  }`}
                  title={hasData ? 'Ano com lançamentos cadastrados' : undefined}
                >
                  <span className="flex items-center gap-1.5">
                    {y}
                    {hasData && <span className="w-1.5 h-1.5 rounded-full bg-brand/60 shrink-0" />}
                  </span>
                  {selected && <Check size={14} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
