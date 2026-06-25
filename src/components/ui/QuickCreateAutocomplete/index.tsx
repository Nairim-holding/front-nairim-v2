'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Plus, Check } from 'lucide-react';
import type { Option } from '@/types/types';

export const QUICK_CREATE_PREFIX = '__new__:';

export const isQuickCreateSentinel = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.startsWith(QUICK_CREATE_PREFIX);

export const extractQuickCreateName = (value: string): string =>
  value.slice(QUICK_CREATE_PREFIX.length);

interface QuickCreateAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  groups?: { label: string; options: Option[]; color?: 'green' | 'red' | 'blue' | 'gray' }[];
}

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export default function QuickCreateAutocomplete({
  value,
  onChange,
  options,
  disabled,
  placeholder = 'Selecione ou digite...',
  className,
  groups
}: QuickCreateAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const flatOptions = useMemo(() => {
    if (groups) {
      return groups.flatMap(g => g.options);
    }
    return options || [];
  }, [options, groups]);

  // Resolve the label of the currently selected item so it appears when the field is not focused.
  const selectedLabel = useMemo(() => {
    if (!value) return '';
    if (isQuickCreateSentinel(value)) return extractQuickCreateName(value);
    return flatOptions.find(o => String(o.value) === String(value))?.label ?? '';
  }, [value, flatOptions]);

  // Sync query with selected label when not editing.
  useEffect(() => {
    if (!isOpen) setQuery(selectedLabel);
  }, [selectedLabel, isOpen]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return flatOptions.slice(0, 50);
    return flatOptions
      .filter(o => normalize(String(o.label)).includes(q))
      .slice(0, 50);
  }, [flatOptions, query]);

  const exactMatch = useMemo(() => {
    const q = normalize(query);
    if (!q) return false;
    return flatOptions.some(o => normalize(String(o.label)) === q);
  }, [flatOptions, query]);

  const showCreateOption = isOpen && query.trim().length > 0 && !exactMatch;
  const createIndex = filtered.length; // create option goes after filtered list

  const calculatePosition = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const dropdownHeight = 250;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;
    // Auto-largura: cresce além do campo até caber o texto mais longo, sem
    // estourar a viewport à direita (teto absoluto de 480px).
    const maxWidth = Math.min(480, window.innerWidth - rect.left - 12);
    setDropdownStyle({
      position: 'fixed',
      left: rect.left,
      top: openAbove ? rect.top - dropdownHeight : rect.bottom,
      minWidth: rect.width,
      maxWidth: Math.max(rect.width, maxWidth),
      maxHeight: openAbove ? Math.min(dropdownHeight, spaceAbove - 10) : Math.min(dropdownHeight, spaceBelow - 10),
      zIndex: 9999,
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    calculatePosition();
    const onScroll = () => calculatePosition();
    const onResize = () => calculatePosition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [isOpen, calculatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [isOpen]);

  const commitSelect = (val: string, label: string) => {
    onChange(val);
    setQuery(label);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const commitCreate = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onChange(`${QUICK_CREATE_PREFIX}${trimmed}`);
    setQuery(trimmed);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    const totalItems = filtered.length + (showCreateOption ? 1 : 0);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
      setHighlightedIndex(i => Math.min(i + 1, totalItems - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
        const opt = filtered[highlightedIndex];
        commitSelect(String(opt.value), String(opt.label));
      } else if (showCreateOption && (highlightedIndex === createIndex || highlightedIndex === -1)) {
        commitCreate(query);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setQuery(selectedLabel);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? query : selectedLabel}
          onChange={e => {
            setQuery(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(-1);
            // Limpa seleção se o usuário começar a digitar algo diferente do label atual.
            if (value && normalize(e.target.value) !== normalize(selectedLabel)) {
              onChange('');
            }
          }}
          onFocus={() => {
            if (disabled) return;
            setIsOpen(true);
            setQuery('');
            setHighlightedIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          className={`w-full px-2 pr-7 h-[28px] text-[13px] border rounded outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all ${disabled ? 'bg-gray-100 text-content-muted cursor-not-allowed' : 'bg-surface hover:border-brand/50'} ${isOpen ? 'border-brand ring-2 ring-brand/20' : 'border-ui-border'} ${className ?? ''}`}
        />
        <ChevronDown
          size={14}
          className={`absolute right-2 top-1/2 -translate-y-1/2 text-content-muted pointer-events-none transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="fixed bg-surface border border-brand/30 rounded-lg shadow-2xl overflow-y-auto py-1 animate-in fade-in slide-in-from-top-1 duration-150"
          role="listbox"
        >
          {filtered.length === 0 && !showCreateOption && (
            <div className="px-2 py-2 text-[12px] text-content-muted">Nenhum item encontrado</div>
          )}

          {groups ? (
            groups.map((group, gIdx) => {
              const isIncome = group.label.toLowerCase().includes('receita');
              const isExpense = group.label.toLowerCase().includes('despesa');
              const groupColor = group.color || (isIncome ? 'green' : isExpense ? 'red' : 'gray');
              const headerClass = {
                green: 'text-green-600 border-ui-border-soft',
                red: 'text-red-600 border-ui-border-soft',
                blue: 'text-blue-600 border-ui-border-soft',
                gray: 'text-content-muted border-ui-border-soft'
              }[groupColor];

              const groupFiltered = group.options.filter(o => filtered.some(f => f.value === o.value));
              if (groupFiltered.length === 0) return null;

              return (
                <div key={gIdx}>
                  <div className={`px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider border-y ${headerClass}`}>
                    {group.label}
                  </div>
                  {groupFiltered.map((opt) => {
                    const globalIdx = filtered.findIndex(o => o.value === opt.value);
                    const isHighlighted = globalIdx === highlightedIndex;
                    const isSelected = String(opt.value) === String(value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => commitSelect(String(opt.value), String(opt.label))}
                        onMouseEnter={() => setHighlightedIndex(globalIdx)}
                        className={`w-full px-2 py-1.5 text-[12px] text-left flex items-center justify-between transition-colors ${
                          isHighlighted ? 'bg-brand/10 text-brand' : 'hover:bg-surface-subtle'
                        } ${isSelected ? 'bg-brand/5 font-medium text-brand' : 'text-content'}`}
                      >
                        <span className="whitespace-normal break-words">{opt.label}</span>
                        {isSelected && <Check size={12} className="text-brand flex-shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              );
            })
          ) : (
            filtered.map((opt, idx) => {
              const isHighlighted = idx === highlightedIndex;
              const isSelected = String(opt.value) === String(value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => commitSelect(String(opt.value), String(opt.label))}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`w-full px-2 py-1.5 text-[12px] text-left flex items-center justify-between transition-colors ${
                    isHighlighted ? 'bg-brand/10 text-brand' : 'hover:bg-surface-subtle'
                  } ${isSelected ? 'bg-brand/5 font-medium text-brand' : 'text-content'}`}
                >
                  <span className="whitespace-normal break-words">{opt.label}</span>
                  {isSelected && <Check size={12} className="text-brand flex-shrink-0 ml-1" />}
                </button>
              );
            })
          )}

          {showCreateOption && (
            <button
              type="button"
              role="option"
              onMouseDown={e => e.preventDefault()}
              onClick={() => commitCreate(query)}
              onMouseEnter={() => setHighlightedIndex(createIndex)}
              className={`w-full px-2 py-1.5 text-[12px] text-left flex items-center gap-1.5 border-t border-ui-border-soft transition-colors ${
                highlightedIndex === createIndex ? 'bg-brand/10 text-brand' : 'text-brand hover:bg-brand/5'
              }`}
            >
              <Plus size={12} className="flex-shrink-0" />
              <span className="whitespace-normal break-words">Adicionar novo: <strong>&ldquo;{query.trim()}&rdquo;</strong></span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
