/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useCallback, useMemo, useEffect, useRef, useLayoutEffect } from "react";
import { Filter, Trash2, Copy, Edit2, Save, X, Plus, Calendar, ChevronDown, Check, CreditCard, DollarSign, Settings2, RefreshCw, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { useMessageContext } from "@/contexts/MessageContext";
import { usePopupContext } from "@/contexts/PopupContext";
import Toggle from "@/components/ui/Toggle";
import SkeletonTable from "../TableSkeleton";
import DynamicFilterModal from "../../filters/DynamicFilterModal";
import SearchInput from "../../filters/SearchInput";
import SelectLimit from "../../filters/PageSizeSelect";
import Pagination from "../../filters/Pagination";
import TableInformations from "../TableHeader";
import ColumnCustomizer from "../ColumnCustomizer";
import ParceladoRecorrenteModal from "@/components/modals/ParceladoRecorrenteModal";
import InvoiceModal from "@/components/modals/InvoiceModal";
import { formatCurrency, formatDate, parseCurrencyFromPTBR } from "@/utils/displayFormatters";
import { maskMoney, formatCurrencyRealtime } from "@/utils/masks";
import { useOptimizedTableData } from "@/hooks/useOptimizedTableData";
import { useDynamicFilters } from "@/hooks/useDynamicFilters";
import { ColumnDef, Option } from "@/types/types";
import CalendarPicker from "@/components/ui/CalendarPicker";
import QuickCreateAutocomplete, { isQuickCreateSentinel, extractQuickCreateName } from "@/components/ui/QuickCreateAutocomplete";
import SummaryPanel from "@/components/domain/financial/SummaryPanel";

// Componente Select customizado que abre no foco e permite navegação por Tab
interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options?: Option[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  groups?: { label: string; options: Option[]; color?: 'green' | 'red' | 'blue' | 'gray' }[];
}

function CustomSelect({ value, onChange, options = [], disabled, placeholder = "Selecione...", className, groups }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mouseDownRef = useRef(false);

  // Scroll horizontal quando o select é aberto
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const container = buttonRef.current.closest('.overflow-x-auto') as HTMLElement;
      if (container) {
        const buttonRect = buttonRef.current.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        // Encontrar todas as colunas de ação fixa (sticky right-0)
        const actionColumns = container.querySelectorAll('td.sticky.right-0');
        let actionColumnWidth = 0;
        actionColumns.forEach(col => {
          actionColumnWidth += (col as HTMLElement).offsetWidth;
        });

        // Se não encontrou, tentar pelo className
        if (actionColumnWidth === 0) {
          const actionColumnsAlt = container.querySelectorAll('[class*="sticky"][class*="right"]');
          actionColumnsAlt.forEach(col => {
            actionColumnWidth += (col as HTMLElement).offsetWidth;
          });
        }

        // Largura fixa de fallback se não conseguir detectar
        if (actionColumnWidth === 0) {
          actionColumnWidth = 70; // largura da coluna de ação
        }

        const buttonLeft = buttonRect.left - containerRect.left + container.scrollLeft;
        const buttonRight = buttonLeft + buttonRect.width;
        const containerWidth = containerRect.width - actionColumnWidth;
        const currentScrollLeft = container.scrollLeft;

        const isFullyVisible = buttonLeft >= currentScrollLeft && buttonRight <= currentScrollLeft + containerWidth;

        if (!isFullyVisible) {
          let newScrollLeft;

          if (buttonRect.width > containerWidth) {
            newScrollLeft = buttonLeft;
          } else if (buttonLeft < currentScrollLeft) {
            newScrollLeft = buttonLeft;
          } else if (buttonRight > currentScrollLeft + containerWidth) {
            newScrollLeft = buttonRight - containerWidth;
          } else {
            newScrollLeft = buttonLeft - (containerWidth / 2) + (buttonRect.width / 2);
          }

          container.scrollTo({
            left: Math.max(0, newScrollLeft),
            behavior: 'smooth'
          });
        }
      }
    }
  }, [isOpen]);

  const flatOptions = useMemo(() => {
    if (groups) {
      return groups.flatMap(g => g.options);
    }
    return options || [];
  }, [options, groups]);

  const selectedLabel = useMemo(() => {
    const opt = flatOptions.find(o => o.value === value);
    return opt?.label || placeholder;
  }, [flatOptions, value, placeholder]);

  const safeOptions = options || [];

  useEffect(() => {
    if (!isOpen) {
      setHighlightedIndex(-1);
      return;
    }
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    
    if (e.key === 'Tab') {
      e.preventDefault();
      if (!isOpen) {
        // Abre o dropdown mantendo highlight no valor atual (não seleciona nada ainda)
        const currentIdx = flatOptions?.findIndex(o => o.value === value);
        setIsOpen(true);
        setHighlightedIndex(currentIdx >= 0 ? currentIdx : -1);
      } else {
        // Dropdown aberto: Tab navega para próxima opção
        const direction = e.shiftKey ? -1 : 1;
        const newIndex = highlightedIndex + direction;
        
        if (newIndex >= 0 && newIndex < (flatOptions?.length || 0)) {
          // Ainda tem opções para navegar
          setHighlightedIndex(newIndex);
        } else {
          // Chegou no início ou fim: fecha e vai para próximo campo
          setIsOpen(false);
          const focusable = document.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
          const currentIndex = Array.from(focusable).indexOf(buttonRef.current!);
          const nextIndex = e.shiftKey ? currentIndex - 1 : currentIndex + 1;
          (focusable[nextIndex] as HTMLElement)?.focus();
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex((i: number) => Math.min(i + 1, (flatOptions?.length || 0) - 1));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex((flatOptions?.length || 0) - 1);
      } else {
        setHighlightedIndex((i: number) => Math.max(i - 1, 0));
      }
    } else if (e.key === 'Enter' && isOpen && highlightedIndex >= 0 && flatOptions?.[highlightedIndex]) {
      e.preventDefault();
      // Só seleciona com Enter
      onChange(String(flatOptions[highlightedIndex].value));
      setIsOpen(false);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  const handleMouseDown = () => {
    mouseDownRef.current = true;
  };

  const handleFocus = () => {
    // Se o foco veio de um clique do mouse, quem decide abrir/fechar é o
    // onClick (mesmo ciclo síncrono do evento) — evita a corrida foco×clique
    // que fazia o dropdown abrir e fechar no mesmo clique.
    if (mouseDownRef.current) return;
    if (!disabled && !isOpen) {
      const currentIdx = flatOptions?.findIndex(o => o.value === value);
      calculatePosition();
      setIsOpen(true);
      // Highlight no valor atual, ou -1 se não houver valor
      setHighlightedIndex(currentIdx >= 0 ? currentIdx : -1);
    }
  };

  const handleClick = () => {
    if (disabled) return;
    mouseDownRef.current = false;
    if (!isOpen) calculatePosition();
    setIsOpen(o => !o);
  };

  const calculatePosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownHeight = 250; // max-h-[250px]
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      // Se não cabe embaixo, abre em cima
      const openAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

      // Auto-largura: o painel cresce além da célula até caber o texto mais longo,
      // limitado para não estourar a viewport à direita (e teto absoluto de 480px).
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
    }
  }, []);

  // Recalcular posição quando scrollar ou redimensionar
  useEffect(() => {
    if (isOpen) {
      calculatePosition();
      const handleScroll = () => calculatePosition();
      const handleResize = () => calculatePosition();
      
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [isOpen, calculatePosition]);

  // Scroll para opção selecionada quando abrir
  useEffect(() => {
    if (isOpen && dropdownRef.current && highlightedIndex >= 0) {
      const buttons = dropdownRef.current.querySelectorAll('button[role="option"]');
      const selectedButton = buttons[highlightedIndex] as HTMLElement;
      if (selectedButton) {
        selectedButton.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [isOpen, highlightedIndex]);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        ref={buttonRef}
        type="button"
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`w-full px-2 h-[28px] text-[13px] border rounded outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand text-left flex justify-between items-center transition-all ${disabled ? 'bg-gray-100 text-content-muted cursor-not-allowed' : 'bg-surface hover:border-brand/50'} ${isOpen ? 'border-brand ring-2 ring-brand/20' : 'border-ui-border'} ${className}`}
        tabIndex={0}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className={`truncate ${!value ? 'text-content-muted' : 'text-content'}`}>{selectedLabel}</span>
        <ChevronDown size={14} className={`ml-1 text-content-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div 
          ref={dropdownRef}
          style={dropdownStyle}
          className="fixed bg-surface border border-brand/30 rounded-lg shadow-2xl overflow-y-auto py-1 animate-in fade-in slide-in-from-top-1 duration-150"
          role="listbox"
        >
          {groups ? (
            groups.map((group, gIdx) => {
              // Determinar cores baseado no label do grupo
              const isIncome = group.label.toLowerCase().includes('receita');
              const isExpense = group.label.toLowerCase().includes('despesa');
              const groupColor = group.color || (isIncome ? 'green' : isExpense ? 'red' : 'gray');
              
              const headerClass = {
                green: 'text-green-600 border-ui-border-soft',
                red: 'text-red-600 border-ui-border-soft',
                blue: 'text-blue-600 border-ui-border-soft',
                gray: 'text-content-muted border-ui-border-soft'
              }[groupColor];
              
              
              return (
                <div key={gIdx}>
                  <div className={`px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider border-y ${headerClass}`}>
                    {group.label}
                  </div>
                  {group.options.map((opt) => {
                    const globalIdx = flatOptions.findIndex(o => o.value === opt.value);
                    const isHighlighted = globalIdx === highlightedIndex;
                    const isSelected = opt.value === value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => { onChange(String(opt.value)); setIsOpen(false); buttonRef.current?.focus(); }}
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
            safeOptions.map((opt, optIdx) => {
              const isHighlighted = optIdx === highlightedIndex;
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => { onChange(String(opt.value)); setIsOpen(false); buttonRef.current?.focus(); }}
                  onMouseEnter={() => setHighlightedIndex(optIdx)}
                  className={`w-full px-2 py-1.5 text-[12px] text-left flex items-center justify-between transition-colors ${
                    isHighlighted ? 'bg-brand/15 text-brand' : 'hover:bg-surface-subtle'
                  } ${isSelected ? 'bg-brand/10 font-medium text-brand' : 'text-content'}`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check size={12} className="text-brand flex-shrink-0 ml-1" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

interface InlineEditableTableProps {
  resource: string;
  title: string;
  columns: ColumnDef[];
  autoFocusSearch?: boolean;
  defaultSort?: Record<string, any>;
  defaultLimit?: number;
  enableCreate?: boolean;
  enableDelete?: boolean;
  formOptions?: { categories: Option[]; incomeCategories: Option[]; expenseCategories: Option[]; institutions: Option[]; cards: Option[]; centers: Option[]; suppliers: Option[]; subcategories: { [categoryId: string]: Option[] }; };
  onRowSave?: (id: string, data: any) => Promise<void>;
  onRowCreate?: (data: any) => Promise<void>;
  onRowDelete?: (id: string) => Promise<void>;
  /**
   * Duplica um registro selecionado, criando uma cópia idêntica (mesma data,
   * valor, status, etc.). Recebe o item original completo. Resolver
   * `{ skipped: true }` sinaliza que o item foi ignorado (ex.: transferência),
   * para contabilizar no resultado sem tratar como erro.
   */
  onRowDuplicate?: (item: any) => Promise<{ skipped?: boolean } | void>;
  enableDuplicate?: boolean;
  showTotals?: boolean;
  /** Exibe o painel lateral retrátil de "Resumo" (somente Lançamentos). */
  summaryPanel?: boolean;
  onColumnsChange?: (columns: ColumnDef[]) => void;
  onColumnWidthsChange?: (widths: Record<string, number>) => void;
  savedColumnWidths?: Record<string, number>;
  visibleColumns?: string[];
  onVisibilityChange?: (visibleFields: string[]) => void;
  /** Notifica o pai sempre que os filtros aplicados na grid mudarem. */
  onAppliedFiltersChange?: (filters: Record<string, any>) => void;
  /**
   * Resolve valores-sentinela de "cadastro rápido" (`__new__:Nome`) vindos do
   * `QuickCreateAutocomplete`, criando o registro via API e devolvendo o objeto
   * com os IDs reais. Mesma função usada no fluxo normal de criar/editar linha —
   * reaproveitada aqui para o modal de Parcelado/Recorrente.
   */
  resolveQuickCreates?: (data: Record<string, any>) => Promise<Record<string, any>>;
}

interface EditingRow {
  id: string; data: any; isEditing: boolean; isNew: boolean; isSaving: boolean; errors: Record<string, string>;
}

export default function InlineEditableTable({
  resource, title, columns, autoFocusSearch = true, defaultSort = {}, defaultLimit = 30, enableCreate = true, enableDelete = true,
  formOptions = { categories: [], incomeCategories: [], expenseCategories: [], institutions: [], cards: [], centers: [], suppliers: [], subcategories: {} },
  showTotals = true, summaryPanel = false, onRowSave, onRowCreate, onRowDelete, onRowDuplicate, enableDuplicate = false, onColumnsChange, onColumnWidthsChange, savedColumnWidths, visibleColumns, onVisibilityChange,
  onAppliedFiltersChange,
  resolveQuickCreates,
}: InlineEditableTableProps) {
  const [filterVisible, setFilterVisible] = useState(false);
  const [selectedCheckboxes, setSelectedCheckboxes] = useState<string[]>([]);
  const [appliedFilters, setAppliedFilters] = useState<Record<string, any>>({});
  const [editingRows, setEditingRows] = useState<EditingRow[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [maxRowHeight, setMaxRowHeight] = useState<number | undefined>(undefined);
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [isParceladoModalOpen, setIsParceladoModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  // Toggle: false = Data de efetivação (padrão), true = Data do evento
  const [isEventDate, setIsEventDate] = useState(false);
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>(() => {
    const today = new Date();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(today.getMonth() - 3);
    return {
      from: threeMonthsAgo.toISOString().split('T')[0],
      to: today.toISOString().split('T')[0]
    };
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [hasDateFilter, setHasDateFilter] = useState(true);
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [visibleColumnsState, setVisibleColumnsState] = useState<Set<string>>(new Set(visibleColumns || columns.map(c => c.field)));

  // Sincronizar estado com prop visibleColumns quando mudar
  useEffect(() => {
    if (visibleColumns && visibleColumns.length > 0) {
      setVisibleColumnsState(new Set(visibleColumns));
    }
  }, [visibleColumns]);

  const { showMessage } = useMessageContext();
  const { showPopup } = usePopupContext();
  
  const { filters: dynamicFilters, searchFields, isLoading: isLoadingFilters } = useDynamicFilters(`/${resource}/filters`, appliedFilters);

  useEffect(() => {
    onAppliedFiltersChange?.(appliedFilters);
  }, [appliedFilters, onAppliedFiltersChange]);
  const { state, data, isLoading: isLoadingData, updateState, refreshData } = useOptimizedTableData(resource, {
    page: 1, limit: defaultLimit, search: "", sort: defaultSort, filters: {}
  });

  const dataColumns = useMemo(() => columns.filter(col => col.field !== "actions" && col.type !== "custom"), [columns]);

  const handleVisibilityChange = useCallback((visibleFields: string[]) => {
    const newVisible = new Set(visibleFields);
    setVisibleColumnsState(newVisible);
    // Chamar callback para persistência no servidor (via página pai)
    onVisibilityChange?.(visibleFields);
  }, [onVisibilityChange]);

  // Sincronizar visibilidade de colunas com props
  useEffect(() => {
    if (visibleColumns && visibleColumns.length > 0) {
      setVisibleColumnsState(new Set(visibleColumns));
    }
  }, [visibleColumns]);

  // Inicializar widths na montagem
  useEffect(() => {
    const initialWidths: Record<string, number> = {};
    dataColumns.forEach((col: ColumnDef) => {
      const field = col.field.toLowerCase();
      initialWidths[col.field] = field.includes('description') ? 180 :
        (field.includes('amount') || field.includes('value')) ? 100 :
          (field.includes('date')) ? 110 :
            (field.includes('status')) ? 90 :
              (field.includes('category') || field.includes('subcategory')) ? 130 : 120;
    });
    setColumnWidths(initialWidths);
  }, []);

  // Sincronizar quando preferências são carregadas do servidor
  useEffect(() => {
    if (savedColumnWidths && Object.keys(savedColumnWidths).length > 0) {
      console.log('[InlineEditableTable] Sincronizando widths do servidor:', savedColumnWidths);
      setColumnWidths(prevWidths => ({
        ...prevWidths,
        ...savedColumnWidths
      }));
    }
  }, [savedColumnWidths]);

  // Apply default date filter on mount
  useEffect(() => {
    const today = new Date();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(today.getMonth() - 3);
    const defaultDateRange = {
      from: threeMonthsAgo.toISOString().split('T')[0],
      to: today.toISOString().split('T')[0]
    };
    
    setDateRange(defaultDateRange);
    
    // Apply to filters - padrão é Data de efetivação (isEventDate = false)
    const filters: Record<string, any> = {
      ...appliedFilters,
      effective_date: { from: defaultDateRange.from, to: defaultDateRange.to }
    };
    setAppliedFilters(filters);
    updateState({ filters, page: 1 });
  }, []);

  // Atualizar filtro quando o tipo de data mudar (event_date <-> effective_date)
  useEffect(() => {
    if (hasDateFilter && dateRange.from && dateRange.to) {
      const newDateField = isEventDate ? 'event_date' : 'effective_date';
      const oldDateField = isEventDate ? 'effective_date' : 'event_date';
      
      // Remover o filtro antigo e adicionar o novo
      const { [oldDateField]: removed, ...otherFilters } = appliedFilters;
      void removed; // evitar warning de unused
      const newFilters = {
        ...otherFilters,
        [newDateField]: { from: dateRange.from, to: dateRange.to }
      };
      
      setAppliedFilters(newFilters);
      updateState({ filters: newFilters, page: 1 });
    }
  }, [isEventDate]);

  const handleApplyFilters = useCallback((f: Record<string, any>) => {
    const df = isEventDate ? 'event_date' : 'effective_date';
    setAppliedFilters({ ...dateRange.from && dateRange.to ? { [df]: { from: dateRange.from, to: dateRange.to } } : {}, ...f });
    updateState({ filters: { ...dateRange.from && dateRange.to ? { [df]: { from: dateRange.from, to: dateRange.to } } : {}, ...f }, page: 1 });
    setFilterVisible(false);
  }, [isEventDate, dateRange, updateState]);

  const handleClearFilters = useCallback(() => {
    const df = isEventDate ? 'event_date' : 'effective_date';
    setAppliedFilters(dateRange.from && dateRange.to ? { [df]: { from: dateRange.from, to: dateRange.to } } : {});
    updateState({ filters: dateRange.from && dateRange.to ? { [df]: { from: dateRange.from, to: dateRange.to } } : {}, page: 1 });
    setFilterVisible(false);
  }, [isEventDate, dateRange, updateState]);

  // Close date picker when clicking outside
  const datePickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false);
      }
    };
    if (showDatePicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDatePicker]);

  const isResizingRef = useRef<{field: string, startX: number, startWidth: number} | null>(null);
  const columnWidthsRef = useRef<Record<string, number>>(columnWidths);

  // Atualizar ref quando columnWidths muda
  useEffect(() => {
    columnWidthsRef.current = columnWidths;
  }, [columnWidths]);

// Scroll horizontal otimizado: funciona no foco e durante a digitação
  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;

    const scrollToElement = (element: HTMLElement) => {
      if (!container.contains(element)) return;

      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();

      // Calcula a largura da coluna de ações fixa para não escondermos o input atrás dela
      const actionCols = container.querySelectorAll('.sticky.right-0, [class*="sticky"][class*="right"]');
      let stickyWidth = 70; // Fallback
      actionCols.forEach(col => {
        stickyWidth = Math.max(stickyWidth, (col as HTMLElement).offsetWidth);
      });

      // Define as fronteiras visíveis e o respiro adicional
      const padding = 24; 
      const extraOffset = 80; // Os 80px extras que você pediu
      const visibleLeft = containerRect.left;
      const visibleRight = containerRect.right - stickyWidth;

      let newScrollLeft = container.scrollLeft;

      // Verifica se o input está cortado/escondido na esquerda
      if (elementRect.left < visibleLeft + padding) {
        newScrollLeft -= (visibleLeft - elementRect.left + padding + extraOffset);
      } 
      // Verifica se o input está escondido debaixo da coluna fixa à direita
      else if (elementRect.right > visibleRight - padding) {
        newScrollLeft += (elementRect.right - visibleRight + padding + extraOffset);
      }

      // IMPORTANTE: Só dispara o scroll se o input realmente estiver fora do campo de visão.
      // Isso impede que a tela fique tremendo a cada letra digitada se o campo já estiver visível.
      if (newScrollLeft !== container.scrollLeft) {
        container.scrollTo({
          left: Math.max(0, newScrollLeft),
          behavior: 'smooth'
        });
      }
    };

    const handleInteraction = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(target.tagName)) {
        // Um pequeno delay garante que qualquer re-renderização do React ou
        // expansão de texto termine antes de calcular a posição
        setTimeout(() => scrollToElement(target), 50);
      }
    };

    // Adicionamos de volta os eventos para capturar digitação e navegação pelo teclado
    container.addEventListener('focusin', handleInteraction); // Quando clica ou entra no campo
    container.addEventListener('input', handleInteraction);   // Quando digita algo
    container.addEventListener('keyup', handleInteraction);   // Quando usa setas, Tab, etc.

    return () => {
      container.removeEventListener('focusin', handleInteraction);
      container.removeEventListener('input', handleInteraction);
      container.removeEventListener('keyup', handleInteraction);
    };
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current) return;
    const { field, startX, startWidth } = isResizingRef.current;
    const newWidth = Math.max(60, startWidth + (e.pageX - startX));
    console.log(`[InlineEditableTable] Resizing ${field}: ${newWidth}px`);
    setColumnWidths(prev => ({ ...prev, [field]: newWidth }));
  }, []);

  const handleMouseUp = useCallback(() => {
    if (isResizingRef.current) {
      // Usar ref para capturar valor atual de columnWidths
      const currentWidths = { ...columnWidthsRef.current };
      console.log('[InlineEditableTable] handleMouseUp - columnWidths:', currentWidths);
      console.log('[InlineEditableTable] Campo redimensionado:', isResizingRef.current.field);
      onColumnWidthsChange?.(currentWidths);
    }
    isResizingRef.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [onColumnWidthsChange]);

  const handleMouseDownResize = useCallback((e: React.MouseEvent, field: string) => {
    e.preventDefault(); e.stopPropagation();
    isResizingRef.current = { field, startX: e.pageX, startWidth: columnWidthsRef.current[field] || 150 };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove, handleMouseUp]);

  // Reordenar colunas
  const handleColumnReorder = useCallback((dragIndex: number, dropIndex: number) => {
    const newColumns = [...columns];
    const [draggedColumn] = newColumns.splice(dragIndex, 1);
    newColumns.splice(dropIndex, 0, draggedColumn);
    onColumnsChange?.(newColumns);
  }, [columns, onColumnsChange]);

  const handleResetColumns = useCallback(() => {
    onColumnWidthsChange?.({});
  }, [onColumnWidthsChange]);

  const { items, meta } = useMemo(() => {
    if (!data) return { items: [], meta: null };
    const itemsData = Array.isArray(data.data) ? data.data : Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : [];
    return {
      items: itemsData,
      meta: data.meta || { page: data.currentPage || 1, limit: state.limit, total: data.total || itemsData.length, totalPages: data.totalPages || 1 }
    };
  }, [data, state.limit]);

  const tableData = useMemo(() => {
    if (!meta || !meta.total) return { start: 0, end: 0 };
    return { start: (meta.page - 1) * meta.limit + 1, end: Math.min(meta.page * meta.limit, meta.total) };
  }, [meta]);

  const filteredItems = useMemo(() => {
    if (activeTab === 'ALL') return items;
    return items.filter((item: any) => {
      const isIncome = item.category?.type === 'INCOME';
      return activeTab === 'INCOME' ? isIncome : !isIncome;
    });
  }, [items, activeTab]);

  const totals = useMemo(() => {
    if (!showTotals) return { totalIncome: 0, totalExpense: 0, balance: 0 };

    // Calcular no frontend com base nos itens filtrados
    // O summary do backend não tem informação de INCOME/EXPENSE, apenas status
    if (!filteredItems?.length) return { totalIncome: 0, totalExpense: 0, balance: 0 };
    return filteredItems.reduce((acc: any, item: any) => {
      const amount = typeof item.amount === 'number' ? item.amount : parseCurrencyFromPTBR(item.amount);
      item.category?.type === 'INCOME' ? (acc.totalIncome += amount) : (acc.totalExpense += amount);
      acc.balance = acc.totalIncome - acc.totalExpense;
      return acc;
    }, { totalIncome: 0, totalExpense: 0, balance: 0 });
  }, [filteredItems, showTotals, activeTab]);

  // Saldos vindos do backend (líquidos, sobre TODO o período/histórico, não só a
  // página atual). Quando presentes têm prioridade sobre o cálculo client-side.
  const serverTotals = (data?.totals && typeof data.totals === 'object') ? data.totals : null;
  const periodBalance = typeof serverTotals?.periodBalance === 'number'
    ? serverTotals.periodBalance
    : totals.balance;
  const accumulatedBalance = typeof serverTotals?.accumulatedBalance === 'number'
    ? serverTotals.accumulatedBalance
    : null;

  // Dados do painel de Resumo (tipo × status, sem transferências) — vêm do mesmo
  // `data.totals` da grid, logo respeitam exatamente período + filtros aplicados.
  const summaryData = useMemo(() => {
    if (!summaryPanel || !serverTotals || typeof serverTotals.receitasPrevisto !== 'number') return null;
    return {
      receitasPrevisto: serverTotals.receitasPrevisto,
      receitasRecebido: serverTotals.receitasRecebido,
      despesasPrevisto: serverTotals.despesasPrevisto,
      despesasPago: serverTotals.despesasPago,
      saldoContas: typeof serverTotals.accumulatedBalance === 'number' ? serverTotals.accumulatedBalance : 0,
    };
  }, [summaryPanel, serverTotals]);

  const displayItems = useMemo(() => [
    ...editingRows.filter(row => row.isNew),
    ...filteredItems.map((item: any) => ({ ...item, isEditing: editingRows.some(row => row.id === item.id && row.isEditing) }))
  ], [filteredItems, editingRows]);

  // Calcular altura máxima das linhas e aplicar a todas
  useLayoutEffect(() => {
    if (tableBodyRef.current && displayItems.length > 0) {
      const rows = tableBodyRef.current.querySelectorAll('tr');
      let maxHeight = 0;
      rows?.forEach(row => {
        const height = row.getBoundingClientRect().height;
        if (height > maxHeight) maxHeight = height;
      });
      setMaxRowHeight(maxHeight > 36 ? maxHeight : undefined);
    }
  }, [displayItems, editingRows]);

  const getNestedValue = useCallback((obj: any, path: string) => {
    return path?.split('.').reduce((acc, key) => {
      const match = key.match(/(\w+)\[(\d+)\]/);
      return match ? acc?.[match[1]]?.[parseInt(match[2])] : acc?.[key];
    }, obj);
  }, []);

  const formatCellValue = useCallback((value: any, column: ColumnDef) => {
    if (value == null || value === '') return '-';
    if (column.formatter === 'currency' || column.type === 'currency') return formatCurrency(value);
    if (column.formatter === 'date' || column.type === 'date') return formatDate(value);
    if (column.formatter === 'boolean' || column.type === 'boolean') return value ? 'Sim' : 'Não';
    if (column.type === 'number') return Number(value).toLocaleString('pt-BR');
    return String(value);
  }, []);

  const getCellValue = useCallback((item: any, column: ColumnDef) => {
    const field = column.field;
    if (field === "status" && ['PENDING', 'COMPLETED'].includes(item[field])) {
      const isCompleted = item[field] === 'COMPLETED';
      return <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${isCompleted ? 'text-green-700 bg-green-50 border-green-200' : 'text-yellow-700 bg-yellow-50 border-yellow-200'}`}>{isCompleted ? 'Concluído' : 'Pendente'}</span>;
    }
    if (field === "amount") {
      const isIncome = item.category?.type === 'INCOME';
      return <span className={`font-semibold ${isIncome ? 'text-green-600' : 'text-red-600'}`}>{formatCellValue(item[field], column)}</span>;
    }
    
    const specialFields: Record<string, any> = {
      category_id: item.category?.name, card_id: item.card?.name, subcategory_id: item.subcategory?.name,
      financial_institution_id: item.financial_institution?.name || formOptions.institutions.find(i => i.value === item.financial_institution_id)?.label, center_id: item.center?.name,
      supplier_id: item.supplier?.name || formOptions.suppliers.find(s => s.value === item.supplier_id)?.label
    };
    if (field in specialFields) return formatCellValue(specialFields[field] || '', column);

    // Descrição quebra linha a cada 50 caracteres
    if (field === 'description') {
      const desc = item[field] || '';
      // Quebrar texto em linhas de 50 caracteres
      const chunkSize = 50;
      const chunks = [];
      for (let i = 0; i < desc.length; i += chunkSize) {
        chunks.push(desc.substring(i, i + chunkSize));
      }
      const formattedDesc = chunks.join('\n');

      // Lançamentos recorrentes exibem "(Recorrente)" em cor diferente ao final
      // da descrição — sufixo de render (não é armazenado no dado).
      const isRecurring = item.is_recurring === true || item.payment_mode === 'RECORRENTE';

      return (
        <span
          className="block whitespace-pre-wrap break-words"
          style={{ lineHeight: '14px' }}
        >
          {formattedDesc}
          {isRecurring && <span className="text-brand font-medium"> (Recorrente)</span>}
        </span>
      );
    }

    const val = item[field] || getNestedValue(item, field);
    return typeof val === 'object' && !Array.isArray(val) ? formatCellValue(val?.name || val?.description, column) : formatCellValue(val, column);
  }, [formatCellValue, getNestedValue, formOptions]);

  // Versão "texto puro" de getCellValue, usada na exportação para Excel
  // (getCellValue retorna JSX para status/valor/descrição, que não serve para uma célula).
  const getExportCellValue = useCallback((item: any, column: ColumnDef): string => {
    const field = column.field;
    if (field === "status" && ['PENDING', 'COMPLETED'].includes(item[field])) {
      return item[field] === 'COMPLETED' ? 'Concluído' : 'Pendente';
    }
    if (field === "amount") {
      return formatCellValue(item[field], column);
    }

    const specialFields: Record<string, any> = {
      category_id: item.category?.name, card_id: item.card?.name, subcategory_id: item.subcategory?.name,
      financial_institution_id: item.financial_institution?.name || formOptions.institutions.find(i => i.value === item.financial_institution_id)?.label, center_id: item.center?.name,
      supplier_id: item.supplier?.name || formOptions.suppliers.find(s => s.value === item.supplier_id)?.label
    };
    if (field in specialFields) return formatCellValue(specialFields[field] || '', column);

    if (field === 'description') return item[field] || '';

    const val = item[field] || getNestedValue(item, field);
    return typeof val === 'object' && !Array.isArray(val) ? formatCellValue(val?.name || val?.description, column) : formatCellValue(val, column);
  }, [formatCellValue, getNestedValue, formOptions]);

  const visibleDataColumns = useMemo(() => {
    return dataColumns.filter(col => visibleColumnsState.has(col.field));
  }, [dataColumns, visibleColumnsState]);

  const headers = useMemo(() =>
    visibleDataColumns.map(col => ({ label: col.label, field: col.field, sortParam: col.sortParam || col.field }))
  , [visibleDataColumns]);

  const updateEditingRow = useCallback((id: string, field: string, value: any) => {
    setEditingRows(prev => prev.map(row => row.id === id ? { ...row, data: { ...row.data, [field]: value } } : row));
  }, []);

  const validateEditingRow = useCallback((row: EditingRow) => {
    const d = row.data, e: Record<string, string> = {};
    if (!d.amount || parseCurrencyFromPTBR(d.amount) <= 0) e.amount = 'Valor deve ser maior que zero';
    if (!d.category_id) e.category_id = 'Categoria é obrigatória';
    if (d.category_id && formOptions.subcategories[d.category_id]?.length > 0 && !d.subcategory_id) e.subcategory_id = 'Subcategoria é obrigatória';
    if (!d.financial_institution_id) e.financial_institution_id = 'Instituição é obrigatória';
    if (!d.event_date) e.event_date = 'Data do evento é obrigatória';
    if (!d.effective_date) e.effective_date = 'Data de efetivação é obrigatória';
    return e;
  }, [formOptions]);

  const startEditingRow = useCallback((id: string, isNew = false) => {
    const item = isNew ? {} : items.find((i: any) => i.id === id);
    if (!item && !isNew) return;

    const safeDateInput = (val: any) => val ? String(val).split('T')[0] : '';
    const safeId = (val: any) => val ? String(val) : '';

    let foundSubcategoryId = safeId(item.subcategory_id || item.subcategory?.id);
    if (!foundSubcategoryId && item.category?.subcategories?.length > 0) {
      foundSubcategoryId = safeId(item.category.subcategories[0].id);
    }

    const newRowId = isNew ? `new-${Date.now()}` : id;

    // Pré-preenche a Instituição do novo registro quando o filtro tem EXATAMENTE
    // uma instituição selecionada (agiliza lançamento em massa). O valor do filtro
    // pode vir como array (multi-seleção) ou escalar (valor único). Continua editável.
    const instFilter = appliedFilters.financial_institution_id;
    const selectedInstitutionIds = instFilter == null ? [] : Array.isArray(instFilter) ? instFilter : [instFilter];
    const defaultInstitutionId = selectedInstitutionIds.length === 1 ? String(selectedInstitutionIds[0]) : '';

    setEditingRows(prev => [...prev.filter(r => !r.isNew), {
      id: newRowId,
      data: isNew
        ? { description: '', amount: 0, status: 'PENDING', event_date: new Date().toISOString().split('T')[0], effective_date: new Date().toISOString().split('T')[0], category_id: '', financial_institution_id: defaultInstitutionId, card_id: '', center_id: '', supplier_id: '', subcategory_id: '' }
        : {
            ...item,
            amount: typeof item.amount === 'number' ? item.amount : parseCurrencyFromPTBR(item.amount),
            event_date: safeDateInput(item.event_date),
            effective_date: safeDateInput(item.effective_date),
            category_id: safeId(item.category_id || item.category?.id),
            subcategory_id: foundSubcategoryId,
            financial_institution_id: safeId(item.financial_institution_id || item.financial_institution?.id || item.institution?.id),
            card_id: safeId(item.card_id || item.card?.id),
            center_id: safeId(item.center_id || item.center?.id),
            supplier_id: safeId(item.supplier_id || item.supplier?.id),
          },
      isEditing: true, isNew, isSaving: false, errors: {}
    }]);

    // Fazer scroll horizontal para o primeiro campo editável após um pequeno delay
    setTimeout(() => {
      const container = tableContainerRef.current;
      if (container) {
        const firstInput = container.querySelector('input:not([type="checkbox"]):not([disabled]), select, textarea') as HTMLElement;
        if (firstInput) {
          firstInput.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          firstInput.focus();
        }
      }
    }, 100);
  }, [items, appliedFilters]);

  const saveEditingRow = useCallback(async (id: string) => {
    const row = editingRows.find(r => r.id === id);
    if (!row) return;
    const errors = validateEditingRow(row);
    if (Object.keys(errors).length > 0) return setEditingRows(prev => prev.map(r => r.id === id ? { ...r, errors } : r));

    setEditingRows(prev => prev.map(r => r.id === id ? { ...r, isSaving: true } : r));
    try {
      const newAmount = typeof row.data.amount === 'number' ? row.data.amount : parseCurrencyFromPTBR(row.data.amount);
      const payload: any = {
        ...row.data,
        amount: newAmount,
        card_id: row.data.card_id || null,
        center_id: row.data.center_id || null,
        supplier_id: row.data.supplier_id || null,
        subcategory_id: row.data.subcategory_id || null
      };

      // Propagação de reajuste em parcelados/recorrentes: se o VALOR mudou e a
      // linha pertence a uma série com parcelas SEGUINTES, pergunta se deseja
      // atualizar as demais. Vale para débito e crédito.
      if (!row.isNew) {
        const original = items.find((it: any) => it.id === id);
        const originalAmount = original ? Number(original.amount) : undefined;
        const amountChanged = originalAmount !== undefined && originalAmount !== newAmount;

        const isInstallment = !!original?.installment_group_id && original?.installment_number != null;
        const isRecurring = !!original?.recurring_group_id && original?.occurrence_number != null;
        const total = original?.total_installments ?? null;
        const position = isInstallment ? original?.installment_number : original?.occurrence_number;
        // "Tem seguintes": parcelada com número < total; recorrente assume que
        // pode haver seguintes (o backend filtra por occurrence_number maior).
        const hasFollowing = isInstallment
          ? (total == null || position < total)
          : isRecurring;

        if (amountChanged && (isInstallment || isRecurring) && hasFollowing) {
          const propagate = await new Promise<boolean>((resolve) => {
            showPopup(
              'Atualizar demais parcelas',
              'O valor foi alterado. Deseja atualizar as demais parcelas seguintes desta série?',
              () => resolve(true),
              () => resolve(false),
            );
          });
          if (propagate) payload.propagate_to_following = true;
        }
      }

      if (row.isNew && onRowCreate) await onRowCreate(payload);
      else if (!row.isNew && onRowSave) await onRowSave(id, payload);

      showMessage(`Lançamento ${row.isNew ? 'criado' : 'atualizado'} com sucesso!`, 'success');
      setEditingRows(prev => prev.filter(r => r.id !== id));
      refreshData();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Erro ao salvar', 'error');
      setEditingRows(prev => prev.map(r => r.id === id ? { ...r, isSaving: false } : r));
    }
  }, [editingRows, validateEditingRow, onRowCreate, onRowSave, refreshData, showMessage, items, showPopup]);

  // --- NOVA FUNÇÃO PARA PROCESSAR A DELEÇÃO EM MASSA ---
  const handleDeleteSelected = useCallback(() => {
    if (!selectedCheckboxes.length) return;

    showPopup(
      'Remover Registros',
      selectedCheckboxes.length > 1 
        ? `Você selecionou ${selectedCheckboxes.length} registros. Tem certeza que deseja removê-los?` 
        : `Tem certeza que deseja remover o registro selecionado?`,
      async () => {
        let successCount = 0;
        let errorCount = 0;
        let lastErrorMessage = "";

        for (const id of selectedCheckboxes) {
          try {
            if (onRowDelete) {
              await onRowDelete(id);
              successCount++;
            }
          } catch (error: any) {
            errorCount++;
            lastErrorMessage = error.message || "Erro desconhecido";
          }
        }

        if (errorCount === 0) {
          showMessage(selectedCheckboxes.length > 1 ? `${successCount} registros removidos com sucesso!` : "Registro removido com sucesso!", "success");
        } else {
          showMessage(selectedCheckboxes.length === 1 ? lastErrorMessage : `${successCount} removidos, ${errorCount} erros. ${lastErrorMessage}`, "error");
        }
        
        setSelectedCheckboxes([]);
        refreshData();
      },
      () => {}
    );
  }, [selectedCheckboxes, onRowDelete, showPopup, showMessage, refreshData]);

  // --- DUPLICAÇÃO EM MASSA ---
  // Cria uma cópia idêntica de cada registro selecionado (mesma data, valor,
  // status, etc.). Itens ignorados pelo pai (ex.: transferências) são
  // contabilizados via `{ skipped: true }` sem contar como erro.
  const handleDuplicateSelected = useCallback(() => {
    if (!selectedCheckboxes.length || !onRowDuplicate) return;

    showPopup(
      'Duplicar Registros',
      selectedCheckboxes.length > 1
        ? `Serão criadas ${selectedCheckboxes.length} cópias dos registros selecionados. Deseja continuar?`
        : `Deseja criar uma cópia do registro selecionado?`,
      async () => {
        let successCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        let lastErrorMessage = "";

        for (const id of selectedCheckboxes) {
          const original = items.find((it: any) => it.id === id);
          if (!original) { errorCount++; continue; }
          try {
            const result = await onRowDuplicate(original);
            if (result && result.skipped) skippedCount++;
            else successCount++;
          } catch (error: any) {
            errorCount++;
            lastErrorMessage = error.message || "Erro desconhecido";
          }
        }

        const parts: string[] = [];
        if (successCount > 0) parts.push(`${successCount} ${successCount > 1 ? 'cópias criadas' : 'cópia criada'}`);
        if (skippedCount > 0) parts.push(`${skippedCount} ignorado(s) (transferência)`);
        if (errorCount > 0) parts.push(`${errorCount} erro(s)`);

        if (errorCount === 0) {
          showMessage(parts.join(', ') || 'Nada a duplicar', 'success');
        } else {
          showMessage(`${parts.join(', ')}. ${lastErrorMessage}`, 'error');
        }

        setSelectedCheckboxes([]);
        refreshData();
      },
      () => {}
    );
  }, [selectedCheckboxes, onRowDuplicate, items, showPopup, showMessage, refreshData]);

  // Exporta para .xlsx todos os registros que casam com o período/filtros/busca
  // atualmente aplicados (não apenas a página em exibição) — pagina internamente
  // respeitando o limite de 100 registros por requisição do backend.
  const handleExportExcel = useCallback(async () => {
    if (!meta || meta.total === 0) {
      showMessage('Não há dados para exportar', 'error');
      return;
    }

    setIsExporting(true);
    try {
      const exportLimit = 100;
      const totalPages = Math.max(1, Math.ceil(meta.total / exportLimit));
      const allItems: any[] = [];

      for (let p = 1; p <= totalPages; p++) {
        const params = new URLSearchParams();
        params.append('page', String(p));
        params.append('limit', String(exportLimit));
        if (state.search) params.append('search', state.search);

        Object.entries(state.sort || {}).forEach(([key, value]) => {
          if (value === 'asc' || value === 'desc') {
            params.append(`sort[${key.replace(/^sort_/, '')}]`, value as string);
          }
        });

        Object.entries(state.filters || {}).forEach(([key, value]) => {
          if (value === undefined || value === null || value === '') return;
          params.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
        });

        const res = await fetch(`${process.env.NEXT_PUBLIC_URL_API}/${resource}?${params.toString()}`);
        if (!res.ok) throw new Error(`Erro ${res.status} ao buscar dados para exportação`);
        const json = await res.json();
        const pageItems = Array.isArray(json.data) ? json.data : Array.isArray(json.items) ? json.items : [];
        allItems.push(...pageItems);
      }

      const exportItems = activeTab === 'ALL' ? allItems : allItems.filter((item: any) => {
        const isIncome = item.category?.type === 'INCOME';
        return activeTab === 'INCOME' ? isIncome : !isIncome;
      });

      const rows = exportItems.map((item: any) => {
        const row: Record<string, string | number> = {};
        visibleDataColumns.forEach((col) => {
          // Valor: grava o número real (não a string "R$ ...") para que o Excel
          // reconheça como número e permita SOMA. A formatação de moeda é aplicada
          // como número-formato da célula abaixo, mantendo o valor numérico por baixo.
          if (col.field === 'amount') {
            row[col.label] = typeof item.amount === 'number' ? item.amount : parseCurrencyFromPTBR(item.amount);
          } else {
            row[col.label] = getExportCellValue(item, col);
          }
        });
        return row;
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);

      // Aplica formato de moeda BRL à coluna "Valor", mantendo o conteúdo numérico.
      // O Excel exibe conforme o locale do usuário (pt-BR → vírgula decimal).
      const amountLabel = visibleDataColumns.find((col) => col.field === 'amount')?.label;
      if (amountLabel && rows.length > 0) {
        const range = XLSX.utils.decode_range(worksheet['!ref'] as string);
        // Localiza o índice da coluna do Valor pelo header (linha 0).
        let amountCol = -1;
        for (let c = range.s.c; c <= range.e.c; c++) {
          const headerCell = worksheet[XLSX.utils.encode_cell({ r: 0, c })];
          if (headerCell && headerCell.v === amountLabel) { amountCol = c; break; }
        }
        if (amountCol !== -1) {
          for (let r = range.s.r + 1; r <= range.e.r; r++) {
            const cell = worksheet[XLSX.utils.encode_cell({ r, c: amountCol })];
            if (cell && cell.t === 'n') cell.z = 'R$ #,##0.00';
          }
        }
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, title.slice(0, 31));

      const dateField = isEventDate ? 'event_date' : 'effective_date';
      const periodFilter = state.filters[dateField] as { from?: string; to?: string } | undefined;
      const fromStr = periodFilter?.from || dateRange.from;
      const toStr = periodFilter?.to || dateRange.to;
      const fileName = fromStr && toStr
        ? `lancamentos_${fromStr}_${toStr}.xlsx`
        : `lancamentos_${new Date().toISOString().split('T')[0]}.xlsx`;

      XLSX.writeFile(workbook, fileName);
      showMessage('Exportação concluída com sucesso', 'success');
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Erro ao exportar dados', 'error');
    } finally {
      setIsExporting(false);
    }
  }, [meta, state, resource, activeTab, visibleDataColumns, getExportCellValue, isEventDate, dateRange, title, showMessage]);

  const renderEditableCell = useCallback((item: any, column: ColumnDef, row?: EditingRow) => {
    if (!row?.isEditing) return getCellValue(item, column);
    
    const val = row.data[column.field];
    const err = row.errors[column.field];
    const dis = row.isSaving;
    const upd = (v: any) => updateEditingRow(row.id, column.field, v);
    
    const inputClasses = `w-full px-2 h-[28px] text-[13px] border rounded outline-none focus:border-brand ${err ? 'border-red-500' : 'border-ui-border'} ${dis ? 'bg-gray-100' : 'bg-surface'}`;
    
    const renderWrapper = (children: React.ReactNode) => (
      <div className="w-full relative group">
        {children}
        {err && <p className="text-red-500 text-[11px] mt-1">{err}</p>}
      </div>
    );

    switch (column.field) {
      case 'description':
        return renderWrapper(
          <textarea
            value={val || ''}
            onChange={e => upd(e.target.value)}
            disabled={dis}
            rows={1}
            className={`${inputClasses} resize-none overflow-hidden !h-[24px] text-xs`}
            placeholder="Descrição..."
            style={{ minWidth: '120px', width: '100%' }}
            tabIndex={0}
          />
        );
      case 'amount': {
        // Mantém string formatada no estado durante digitação, parseia no blur
        const displayValue = typeof val === 'string' ? val : (typeof val === 'number' && val > 0 ? maskMoney(val) : '');
        return renderWrapper(
          <input
            type="text"
            inputMode="numeric"
            value={displayValue}
            onChange={e => {
              upd(formatCurrencyRealtime(e.target.value));
            }}
            onBlur={e => {
              const parsed = parseCurrencyFromPTBR(e.target.value);
              upd(parsed);
            }}
            disabled={dis}
            className={inputClasses}
            placeholder="0,00"
            tabIndex={0}
          />
        );
      }
      case 'status':
        return renderWrapper(
          <CustomSelect 
            value={val || 'PENDING'} 
            onChange={v => upd(v)} 
            disabled={dis}
            options={[
              { value: 'PENDING', label: 'Pendente' },
              { value: 'COMPLETED', label: 'Concluído' }
            ]}
          />
        );
      case 'event_date': case 'effective_date': {
        const safeDate = val ? String(val).split('T')[0] : '';
        const isEventDateField = column.field === 'event_date';
        return renderWrapper(
          <input
            type="date"
            value={safeDate}
            onChange={e => upd(e.target.value)}
            disabled={dis}
            className={inputClasses}
            tabIndex={0}
            autoFocus={isEventDateField && row?.isNew}
          />
        );
      }
      case 'category_id':
        const categoryGroups = [
          ...(activeTab === 'ALL' || activeTab === 'INCOME' ? [{ label: 'Receitas', options: formOptions.incomeCategories }] : []),
          ...(activeTab === 'ALL' || activeTab === 'EXPENSE' ? [{ label: 'Despesas', options: formOptions.expenseCategories }] : [])
        ];
        return renderWrapper(
          <QuickCreateAutocomplete 
            value={val || ''} 
            onChange={v => { 
              updateEditingRow(row.id, 'category_id', v); 
              updateEditingRow(row.id, 'subcategory_id', ''); 
              updateEditingRow(row.id, 'center_id', ''); 
            }} 
            disabled={dis}
            groups={categoryGroups.length > 0 ? categoryGroups : undefined}
            options={categoryGroups.length === 0 ? [] : []}
            placeholder="Selecione..."
            currentLabel={item.category?.name}
          />
        );
      case 'subcategory_id':
        const subcategories = formOptions.subcategories[row.data.category_id] || [];
        return renderWrapper(
          <QuickCreateAutocomplete
            value={val || ''}
            onChange={v => upd(v)}
            disabled={dis}
            options={subcategories}
            placeholder="Selecione..."
            currentLabel={item.subcategory?.name}
          />
        );
      case 'financial_institution_id':
        return renderWrapper(
          <QuickCreateAutocomplete
            value={row.data.financial_institution_id || ''}
            onChange={v => updateEditingRow(row.id, 'financial_institution_id', v)}
            disabled={dis}
            options={formOptions.institutions}
            placeholder="Selecione..."
            currentLabel={item.financial_institution?.name}
          />
        );
      case 'card_id':
        return renderWrapper(
          <QuickCreateAutocomplete
            value={val || ''}
            onChange={v => upd(v)}
            disabled={dis}
            options={[{ value: '', label: 'Nenhum' }, ...formOptions.cards]}
            placeholder="Selecione..."
            currentLabel={item.card?.name}
          />
        );
      case 'center_id': {
        const catId = row.data.category_id;
        let txType: 'INCOME' | 'EXPENSE' | 'ALL' = activeTab;

        if (catId) {
          const isIncomeCat = formOptions.incomeCategories.some(c => String(c.value) === String(catId));
          txType = isIncomeCat ? 'INCOME' : 'EXPENSE';
        }

        const incomeCenters = formOptions.centers.filter((c: any) => c.type === 'INCOME');
        const expenseCenters = formOptions.centers.filter((c: any) => c.type === 'EXPENSE');

        const centerGroups = txType === 'ALL' ? [
          ...(incomeCenters.length > 0 ? [{ label: 'Receitas', options: incomeCenters }] : []),
          ...(expenseCenters.length > 0 ? [{ label: 'Despesas', options: expenseCenters }] : [])
        ] : undefined;
        const centerOptions = txType !== 'ALL' 
          ? formOptions.centers.filter((c: any) => c.type === txType || !c.type)
          : formOptions.centers.filter((c: any) => !c.type);
        
        return renderWrapper(
          <QuickCreateAutocomplete
            value={val || ''}
            onChange={v => upd(v)}
            disabled={dis}
            groups={centerGroups}
            options={centerOptions}
            placeholder="Selecione..."
            currentLabel={item.center?.name}
          />
        );
      }
      case 'supplier_id':
        return renderWrapper(
          <QuickCreateAutocomplete
            value={val || ''}
            onChange={v => upd(v)}
            disabled={dis}
            options={formOptions.suppliers}
            currentLabel={item.supplier?.name}
          />
        );
      default:
        return renderWrapper(<input type="text" value={val || ''} onChange={e => upd(e.target.value)} disabled={dis} className={inputClasses} />);
    }
  }, [getCellValue, updateEditingRow, formOptions, activeTab]);

  if (isLoadingFilters || isLoadingData) return <SkeletonTable />;
  if (!Array.isArray(displayItems)) return <div className="flex justify-center items-center my-3"><div className="bg-surface-subtle py-4 px-6 rounded-sm text-content-secondary">Erro ao carregar dados</div></div>;

  return (
    <>
      {/* Linha 1: Tabs */}
      <div className="flex justify-center sm:justify-start items-center mb-2 mt-2">
        <div className="flex bg-surface-subtle p-1 rounded-lg border border-ui-border-soft">
          <button onClick={() => setActiveTab('ALL')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'ALL' ? 'bg-surface shadow-sm text-brand' : 'text-content-secondary hover:text-content'}`}>Todos</button>
          <button onClick={() => setActiveTab('INCOME')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'INCOME' ? 'bg-green-50 border border-green-200 text-green-700 shadow-sm' : 'text-content-secondary hover:text-content'}`}>Receitas</button>
          <button onClick={() => setActiveTab('EXPENSE')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'EXPENSE' ? 'bg-red-50 border border-red-200 text-red-700 shadow-sm' : 'text-content-secondary hover:text-content'}`}>Despesas</button>
        </div>
      </div>

      {/* Linha 2: Filtros, Pesquisa e Saldo */}
      <div className="flex justify-between items-center gap-2 mb-1 flex-wrap lg:flex-nowrap">
        {/* Esquerda: Botões de ação + Pesquisa */}
        <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
          {selectedCheckboxes.length > 0 ? (
            <>
              {enableDelete && <button onClick={handleDeleteSelected} className="bg-surface-subtle p-2 rounded hover:bg-red-100 transition-colors" title="Excluir selecionado(s)"><Trash2 size={20} color="var(--color-error)" /></button>}
              {enableDuplicate && onRowDuplicate && <button onClick={handleDuplicateSelected} className="bg-surface-subtle p-2 rounded hover:bg-brand/10 transition-colors" title="Duplicar selecionado(s)"><Copy size={20} color="var(--color-text-muted)" /></button>}
            </>
          ) : (
            <>
              {enableCreate && <button onClick={() => startEditingRow('new', true)} className="bg-surface-subtle p-2 rounded hover:bg-ui-border transition-colors"><Plus size={20} color="var(--color-text-muted)" /></button>}
              <button
                onClick={() => setIsColumnModalOpen(true)}
                className="hidden sm:block p-2 hover:bg-surface-subtle rounded transition-colors"
                title="Personalizar colunas"
              >
                <Settings2 size={20} color="var(--color-text-muted)" />
              </button>
            </>
          )}
          {(() => {
            const activeFilterCount = Object.keys(appliedFilters).filter(key => key !== 'event_date' && key !== 'effective_date').length;
            return (
              <button onClick={() => setFilterVisible(!filterVisible)} className="p-2 hover:bg-surface-subtle rounded transition-colors relative">
                <Filter size={20} color={activeFilterCount > 0 ? "var(--color-brand-primary)" : "var(--color-text-muted)"} />
                {activeFilterCount > 0 && <span className="absolute -top-1 -right-1 bg-brand text-content-inverse text-xs rounded-full w-5 h-5 flex items-center justify-center">{activeFilterCount}</span>}
              </button>
            );
          })()}

          <div className="relative" ref={datePickerRef}>
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface border border-ui-border rounded-lg hover:border-brand transition-colors text-xs whitespace-nowrap"
              title={hasDateFilter && dateRange.from && dateRange.to ? `${dateRange.from} até ${dateRange.to}` : 'Selecionar período'}
            >
              <Calendar size={14} className={`flex-shrink-0 ${hasDateFilter ? 'text-brand' : 'text-content-muted'}`} />
              <span className="hidden sm:inline text-content-secondary font-medium">
                {hasDateFilter && dateRange.from && dateRange.to
                  ? `${(() => {
                      const parseDateString = (dateStr: string): Date => {
                        const [year, month, day] = dateStr.split('-').map(Number);
                        return new Date(year, month - 1, day);
                      };
                      return `${parseDateString(dateRange.from).toLocaleDateString('pt-BR')} - ${parseDateString(dateRange.to).toLocaleDateString('pt-BR')}`;
                    })()}`
                  : 'Período'
                }
              </span>
            </button>
            
            {showDatePicker && (
              <div className="absolute top-full left-0 mt-2 bg-surface rounded-xl shadow-2xl border border-ui-border-soft p-3 z-50 w-[320px] max-w-[calc(100vw-1rem)] max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-ui-border-soft">
                  <Toggle
                    checked={isEventDate}
                    onChange={setIsEventDate}
                    label={isEventDate ? 'Data do evento' : 'Data de efetivação'}
                  />
                  <button onClick={() => setShowDatePicker(false)} className="p-1 hover:bg-surface-subtle rounded transition-colors"><X size={18} className="text-content-muted" /></button>
                </div>
                <CalendarPicker
                  dateRange={dateRange}
                  onChange={(range) => {
                    setDateRange(range);
                    setHasDateFilter(true);
                    // from === to é válido: período de um único dia (backend trata o intervalo como inclusivo)
                    if (range.from && range.to) {
                      const dateFieldName = isEventDate ? 'event_date' : 'effective_date';
                      const filters: Record<string, any> = { ...appliedFilters };
                      filters[dateFieldName] = { from: range.from, to: range.to };
                      setAppliedFilters(filters);
                      updateState({ filters, page: 1 });
                      setShowDatePicker(false);
                    }
                  }}
                />
              </div>
            )}
          </div>

          <button
            onClick={() => {
              setHasDateFilter(false);
              setDateRange({ from: '', to: '' });
              setAppliedFilters({});
              updateState({ filters: {}, page: 1 });
            }}
            className="flex items-center gap-1 px-2 py-1.5 bg-surface-subtle hover:bg-ui-border rounded-lg transition-colors text-xs text-content-secondary whitespace-nowrap"
            title="Limpar filtros"
          >
            <span className="hidden sm:inline">Limpar</span>
            <X size={12} />
          </button>

          <button
            onClick={() => refreshData()}
            disabled={isLoadingData}
            className="hidden sm:inline-flex p-2 rounded-lg border border-ui-border text-content-muted hover:text-content hover:bg-surface-subtle disabled:opacity-50 transition-colors"
            title="Recarregar"
          >
            <RefreshCw size={16} className={isLoadingData ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={handleExportExcel}
            disabled={isExporting || isLoadingData || meta.total === 0}
            className="hidden sm:inline-flex p-2 rounded-lg border border-ui-border text-content-muted hover:text-content hover:bg-surface-subtle disabled:opacity-50 transition-colors"
            title="Exportar para Excel"
          >
            <FileSpreadsheet size={16} className={isExporting ? 'animate-pulse' : ''} />
          </button>

          {filterVisible && <DynamicFilterModal visible={filterVisible} setVisible={setFilterVisible} onApply={handleApplyFilters} onClear={handleClearFilters} title={title} filters={dynamicFilters} initialValues={appliedFilters} columns={4} maxHeight={title === 'Lançamentos' ? '90vh' : undefined} excludeFieldsFromCount={['event_date', 'effective_date']} />}
          
          {/* Pesquisa: cresce para preencher espaço disponível */}
          <div className="flex-1 min-w-[140px]">
            <SearchInput initialValue={state.search} onSearch={s => updateState({ search: s, page: 1 })} placeholder={`Pesquisar ${title.toLowerCase()}...`} delay={600} autoFocus={autoFocusSearch} />
          </div>
          <div className="hidden sm:block">
            <SelectLimit limit={state.limit} onLimitChange={l => updateState({ limit: l, page: 1 })} />
          </div>
        </div>

        {/* Direita: Ícones + Saldo */}
        <div className="flex items-center gap-2 flex-shrink-0 w-full lg:w-auto justify-start lg:justify-end">
          {/* Ícone para lançamentos parcelados/recorrentes */}
          <button
            onClick={() => setIsParceladoModalOpen(true)}
            className="flex items-center justify-center w-9 h-9 bg-surface text-content border border-ui-border rounded-lg hover:bg-surface-subtle transition-colors"
            title="Inserir Lançamento Parcelado / Recorrente"
          >
            <DollarSign size={18} />
          </button>

          {/* Ícone para faturas de cartão */}
          <button
            onClick={() => setIsInvoiceModalOpen(true)}
            className="flex items-center justify-center w-9 h-9 bg-surface text-content border border-ui-border rounded-lg hover:bg-surface-subtle transition-colors"
            title="Gerenciar Faturas dos Cartões"
          >
            <CreditCard size={18} />
          </button>

          {showTotals && items.length > 0 && (
            <div className="flex flex-col items-end bg-surface-subtle px-3 py-1 rounded-lg border border-ui-border-soft leading-tight">
              {accumulatedBalance !== null && (
                <div className="flex items-center">
                  <span className="text-[11px] text-content-secondary mr-1.5">Saldo acumulado:</span>
                  <span className={`text-xs font-semibold ${accumulatedBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(accumulatedBalance)}
                  </span>
                </div>
              )}
              <div className="flex items-center">
                <span className="text-xs text-content-secondary mr-1.5">Saldo mensal:</span>
                <span className={`text-sm font-semibold ${periodBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(periodBalance)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Container da tabela com altura flexível e rodapé fixo */}
      <div className="relative flex-1 flex flex-col min-h-0">
        {/* Tabela com scroll ocupando espaço disponível */}
        <div ref={tableContainerRef} className="overflow-x-auto rounded-lg shadow-sm flex-1 overflow-y-auto">
        <TableInformations
          headers={headers}
          sort={state.sort}
          onSort={s => updateState({ sort: { [s]: state.sort[s] === "asc" ? "desc" : "asc" }, page: 1 })}
          onSelectAll={e => setSelectedCheckboxes(e.target.checked ? displayItems.map((i: any) => i.id) : [])}
          allSelected={selectedCheckboxes.length === displayItems.length && displayItems.length > 0}
          hasActions={true}
          columnWidths={columnWidths}
          onMouseDownResize={handleMouseDownResize}
          onColumnReorder={handleColumnReorder}
          tbodyRef={tableBodyRef}
          stickyHeader
        >
          {displayItems.map((item: any, rowIdx: number) => {
            const editingRow = editingRows.find(row => row.id === item.id);
            const isEditing = !!editingRow?.isEditing;
            // Zebrado: linhas ímpares recebem um fundo levemente mais escuro
            // (mesmo tom claro/discreto usado no resto do design, bg-surface-subtle)
            // para facilitar a leitura em grids com muitos lançamentos. O hover usa
            // um tom ainda mais forte (bg-surface-muted) para continuar perceptível
            // tanto em cima de uma linha zebrada quanto de uma linha branca.
            const isZebra = rowIdx % 2 === 1;
            const rowBgClass = isEditing ? 'bg-brand/5' : isZebra ? 'bg-surface-subtle' : 'bg-surface';

            return (
              <tr key={item.id} className={`group ${rowBgClass} hover:bg-surface-muted border-b border-ui-border-soft text-content-secondary h-auto transition-colors ${isEditing ? 'border-brand/20' : ''}`} style={maxRowHeight ? { height: `${maxRowHeight}px` } : undefined}>
                {visibleDataColumns.map((col, idx) => (
                  <td key={col.field} className={`align-middle border-r border-ui-border-soft p-0 ${isEditing ? 'bg-transparent' : ''}`} style={{ width: 'auto', minWidth: 'fit-content' }}>
                    <div className={`flex w-full items-center px-0.5 py-0 ${idx === 0 ? 'justify-start' : 'justify-center'}`}>
                      {idx === 0 && enableDelete && !isEditing && <input type="checkbox" className="mr-2 inp-checkbox-select rounded border-ui-border cursor-pointer w-4 h-4" checked={selectedCheckboxes.includes(item.id)} onChange={() => setSelectedCheckboxes(p => p.includes(item.id) ? p.filter(id => id !== item.id) : [...p, item.id])} />}
                      <div className={`w-full min-w-0 text-xs ${idx === 0 || col.align === 'left' ? 'text-left' : col.align === 'right' ? 'text-right' : 'text-center'}`}>{renderEditableCell(item, col, editingRow)}</div>
                    </div>
                  </td>
                ))}
                <td className={`px-0.5 sticky right-0 z-20 border-l border-ui-border-soft align-middle w-auto min-w-fit ${rowBgClass} group-hover:bg-surface-muted transition-colors`}>
                  <div className="flex w-full items-center justify-center gap-0">
                    {isEditing ? (
                      <>
                        <button onClick={() => saveEditingRow(editingRow!.id)} disabled={editingRow!.isSaving} className="p-1 hover:bg-green-100 rounded text-green-600 disabled:opacity-50">{editingRow!.isSaving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600" /> : <Save size={16} />}</button>
                        <button onClick={() => setEditingRows(p => p.filter(r => r.id !== editingRow!.id))} disabled={editingRow!.isSaving} className="p-1 hover:bg-red-100 rounded text-red-600 disabled:opacity-50"><X size={16} /></button>
                      </>
                    ) : (
                      <button onClick={() => startEditingRow(item.id)} className="p-1 hover:bg-surface-subtle rounded text-brand"><Edit2 size={16} /></button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </TableInformations>
        </div>
        
      </div>
      
      {/* Rodapé fixo na parte inferior da tela */}
      <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-ui-border-soft px-3 sm:px-4 py-2 z-50 shadow-lg">
        <div className="flex flex-wrap justify-between items-center gap-2 max-w-[1400px] mx-auto">
          <p className="text-[13px] text-content-secondary">
            {meta && meta.total > 0 ? (
              activeTab === 'ALL'
                ? `Total de registros: ${meta.total} (Exibindo ${tableData.start} a ${tableData.end})`
                : `Total: ${filteredItems.length} registros de ${activeTab === 'INCOME' ? 'Receitas' : 'Despesas'}`
            ) : 'Nenhum registro encontrado'}
          </p>

          <div className="flex items-center gap-3">
            {meta?.totalPages > 1 && <Pagination currentPage={meta.page} totalPage={meta.totalPages} onPageChange={p => updateState({ page: p })} />}
          </div>
        </div>
      </div>
      
      {/* Espaço para o rodapé fixo não cobrir conteúdo */}
      <div className="h-12"></div>

      {/* Modal de Lançamento Parcelado/Recorrente */}
      <ParceladoRecorrenteModal
        isOpen={isParceladoModalOpen}
        onClose={() => setIsParceladoModalOpen(false)}
        formOptions={{
          institutions: formOptions.institutions || [],
          incomeCategories: formOptions.incomeCategories || [],
          expenseCategories: formOptions.expenseCategories || [],
          centers: formOptions.centers || [],
          suppliers: formOptions.suppliers || [],
          cards: formOptions.cards || [],
          subcategories: formOptions.subcategories || {},
        }}
        onSubmit={async (rawData) => {
          try {
            const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

            let data = rawData;
            if (resolveQuickCreates) {
              // Sinal do valor conforme o tipo — mesma heurística usada pelo
              // resolveQuickCreates original para decidir INCOME/EXPENSE ao
              // criar Categoria/Centro por cadastro rápido.
              const amountValue = parseCurrencyFromPTBR(rawData.amount);
              const signedAmount = rawData.transactionType === 'EXPENSE' ? -Math.abs(amountValue) : Math.abs(amountValue);

              const resolvedFields = await resolveQuickCreates({
                category_id: rawData.category,
                subcategory_id: rawData.subcategory,
                financial_institution_id: rawData.institution,
                card_id: rawData.card,
                center_id: rawData.center,
                supplier_id: rawData.supplier,
                amount: signedAmount,
              });

              data = {
                ...rawData,
                category: resolvedFields.category_id,
                subcategory: resolvedFields.subcategory_id,
                institution: resolvedFields.financial_institution_id,
                card: resolvedFields.card_id,
                center: resolvedFields.center_id,
                supplier: resolvedFields.supplier_id,
              };
            }

            // Determinar qual endpoint usar
            let endpoint = '';
            let payload: any = {};
            
            if (data.transactionType === 'INCOME') {
              const numInstallments = parseInt(data.numInstallments) || 1;
              
              if (numInstallments > 1) {
                // Receita parcelada - criar múltiplas receitas
                const installmentAmount = parseCurrencyFromPTBR(data.amount);
                endpoint = '/financial-transaction/installments';
                payload = {
                  transaction_type: 'INCOME',
                  institution_id: data.institution || null,  // ✅ Enviar null se vazio
                  category_id: data.category,
                  subcategory_id: data.subcategory || null,
                  center_id: data.center || null,
                  description: data.description || null,  // ✅ Enviar null se vazio
                  installment_amount: installmentAmount,
                  num_installments: numInstallments,
                  total_amount: installmentAmount * numInstallments,
                  start_date: data.startDate,
                  first_payment_date: data.firstPaymentDate, // Data separada para receita
                };
              } else {
                // Receita: cria lançamento simples (1 parcela)
                endpoint = '/financial-transaction';
                payload = {
                  category_id: data.category,
                  subcategory_id: data.subcategory || null,
                  financial_institution_id: data.institution || null,  // Enviar null se vazio
                  center_id: data.center || null,
                  description: data.description || null,  // Enviar null se vazio
                  amount: parseCurrencyFromPTBR(data.amount),
                  event_date: data.startDate,
                  effective_date: data.firstPaymentDate,
                  status: 'PENDING',
                };
              }
            } else if (data.paymentMode === 'PARCELADO') {
              // Despesa parcelada - amount é o valor DA PARCELA
              const installmentAmount = parseCurrencyFromPTBR(data.amount);
              const numInstallments = parseInt(data.numInstallments);
              endpoint = '/financial-transaction/installments';
              payload = {
                transaction_type: 'EXPENSE',
                institution_id: data.institution,
                card_id: data.card || null,
                category_id: data.category,
                subcategory_id: data.subcategory || null,
                center_id: data.center || null,
                supplier_id: data.supplier || null,
                description: data.description || null,
                installment_amount: installmentAmount,  // Valor de CADA parcela
                num_installments: numInstallments,
                total_amount: installmentAmount * numInstallments,  // Total calculado
                start_date: data.startDate,
                first_payment_date: data.firstPaymentDate,
              };
            } else if (data.paymentMode === 'RECORRENTE') {
              // Despesa recorrente (modelo único infinito): cria config + gera
              // 5 anos de lançamentos conforme a periodicidade ("Se Repete").
              const recurringAmount = parseCurrencyFromPTBR(data.amount);
              endpoint = '/financial-transaction/recurrence';
              payload = {
                transaction_type: 'EXPENSE',
                frequency: data.frequency || 'MONTHLY',
                institution_id: data.institution,
                card_id: data.card || null,
                category_id: data.category,
                subcategory_id: data.subcategory || null,
                center_id: data.center || null,
                supplier_id: data.supplier || null,
                description: data.description || null,
                amount: recurringAmount,
                start_date: data.startDate,
                first_payment_date: data.firstPaymentDate,
              };
            } else {
              // Despesa simples (avulsa)
              endpoint = '/financial-transaction';
              payload = {
                category_id: data.category,
                subcategory_id: data.subcategory || null,
                financial_institution_id: data.institution || null,
                card_id: data.card || null,
                center_id: data.center || null,
                supplier_id: data.supplier || null,
                description: data.description || null,
                amount: parseCurrencyFromPTBR(data.amount),
                event_date: data.startDate,
                effective_date: data.firstPaymentDate,
                status: 'PENDING',
              };
            }
            
            // Debug: log do payload
            console.log('Payload enviado:', JSON.stringify(payload, null, 2));
            
            const response = await fetch(`${API_URL}${endpoint}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            
            if (!response.ok) {
              const error = await response.json().catch(() => ({}));
              throw new Error(error.message || 'Erro ao criar lançamento');
            }
            
            const result = await response.json();
            const count = result.data?.installments?.length || result.data?.occurrences?.length || 1;
            
            showMessage(`${count} lançamento(s) criado(s) com sucesso!`, 'success');
            refreshData();
          } catch (error) {
            console.error('Error creating transaction:', error);
            showMessage(error instanceof Error ? error.message : 'Erro ao criar lançamento', 'error');
            throw error;
          }
        }}
      />

      {/* Modal de Faturas de Cartão */}
      <InvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => {
          setIsInvoiceModalOpen(false);
          // Atualizar tabela após fechar modal
          setTimeout(() => refreshData(), 300);
        }}
        cards={formOptions.cards || []}
        institutions={formOptions.institutions || []}
        onSearchInvoice={async (cardId, month, year) => {
          try {
            const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';
            console.log(`🔍 Buscando fatura: cardId=${cardId}, month=${month}, year=${year}`);
            const response = await fetch(
              `${API_URL}/financial-invoice?cardId=${cardId}&month=${month}&year=${year}`
            );
            console.log(`📡 Response status: ${response.status}`);
            
            if (response.status === 404) {
              showMessage('Fatura não encontrada para este cartão/mês', 'info');
              return null;
            }
            
            if (!response.ok) {
              const error = await response.json().catch(() => ({}));
              showMessage(error.message || 'Erro ao buscar fatura', 'error');
              return null;
            }
            const result = await response.json();
            console.log('✅ Fatura encontrada:', result.data);
            return result.data || null;
          } catch (error) {
            console.error('❌ Error fetching invoice:', error);
            showMessage('Erro de conexão ao buscar fatura', 'error');
            return null;
          }
        }}
        onUpdateStatus={async (invoiceId, status, data) => {
          try {
            const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';
            const payload = { status, ...data };
            console.log('📤 Enviando PUT /status:', payload);
            const response = await fetch(`${API_URL}/financial-invoice/${invoiceId}/status`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            console.log('📡 Response status:', response.status);
            if (!response.ok) {
              const error = await response.json().catch(() => ({}));
              console.log('❌ Erro do backend:', error);
              throw new Error(error.error || error.message || 'Erro ao atualizar fatura');
            }
            showMessage('Fatura atualizada com sucesso!', 'success');
          } catch (error) {
            console.error('Error updating invoice:', error);
            showMessage(error instanceof Error ? error.message : 'Erro ao atualizar fatura', 'error');
            throw error;
          }
        }}
      />
      <ColumnCustomizer
        isOpen={isColumnModalOpen}
        onClose={() => setIsColumnModalOpen(false)}
        columns={columns}
        onReorder={onColumnsChange || (() => {})}
        onReset={handleResetColumns}
        visibleColumns={Array.from(visibleColumnsState)}
        onVisibilityChange={handleVisibilityChange}
      />

      {summaryPanel && (
        <SummaryPanel
          from={hasDateFilter ? dateRange.from : undefined}
          to={hasDateFilter ? dateRange.to : undefined}
          summary={summaryData}
        />
      )}
    </>
  );
}