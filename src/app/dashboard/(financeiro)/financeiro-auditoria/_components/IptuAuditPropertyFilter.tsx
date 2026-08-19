'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Filter, Check, X } from 'lucide-react';

export interface PropertyOption {
  id: string;
  title: string;
}

interface IptuAuditPropertyFilterProps {
  options: PropertyOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

/**
 * Filtro de imóveis da Auditoria de IPTU (Tarefa 4.1): seleção de um ou mais
 * imóveis. Nenhum selecionado = todos, que é o comportamento padrão da tela.
 */
export default function IptuAuditPropertyFilter({ options, selected, onChange }: IptuAuditPropertyFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return options;
    return options.filter((o) => o.title.toLowerCase().includes(term));
  }, [options, search]);

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className={`flex items-center gap-2 border rounded-lg px-3 py-2 text-sm transition-colors ${
          selected.length > 0
            ? 'border-brand text-brand bg-brand/5'
            : 'border-ui-border text-content-secondary bg-surface hover:bg-surface-subtle'
        }`}
        title="Filtrar imóveis considerados na auditoria"
      >
        <Filter size={16} />
        <span className="font-medium whitespace-nowrap">
          {selected.length === 0 ? 'Todos os imóveis' : `${selected.length} imóvel(is)`}
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 max-w-[85vw] bg-surface border border-ui-border-soft rounded-lg shadow-lg z-[200] flex flex-col">
          <div className="p-2 border-b border-ui-border-soft flex items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar imóvel..."
              className="flex-1 px-2 py-1.5 text-sm border border-ui-border rounded-md bg-surface text-content focus:outline-none focus:border-brand"
            />
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="p-1.5 rounded-md text-content-muted hover:text-content hover:bg-surface-subtle"
                title="Limpar seleção"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-xs text-content-muted text-center">Nenhum imóvel encontrado.</p>
            )}
            {filtered.map((option) => {
              const isSelected = selected.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => toggle(option.id)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left text-content-secondary hover:bg-surface-subtle transition-colors"
                >
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-brand border-brand text-content-inverse' : 'border-ui-border'
                    }`}
                  >
                    {isSelected && <Check size={12} />}
                  </span>
                  <span className="truncate">{option.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
