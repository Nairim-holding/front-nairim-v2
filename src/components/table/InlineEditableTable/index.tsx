/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useCallback, useMemo, useEffect, useRef, useLayoutEffect } from "react";
import { Filter, Trash2, Edit2, Save, X, Plus, Calendar, ChevronDown, Check, CreditCard, DollarSign, Settings2 } from "lucide-react";
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
import { formatCurrency, formatDate, parseCurrencyFromPTBR, maskCurrencyInput } from "@/utils/displayFormatters";
import { useOptimizedTableData } from "@/hooks/useOptimizedTableData";
import { useDynamicFilters } from "@/hooks/useDynamicFilters";
import { ColumnDef, Option } from "@/types/types";
import CalendarPicker from "@/components/ui/CalendarPicker";
import QuickCreateAutocomplete, { isQuickCreateSentinel, extractQuickCreateName } from "@/components/ui/QuickCreateAutocomplete";

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
  const justOpenedByFocus = useRef(false);

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

  const handleFocus = () => {
    if (!disabled && !isOpen) {
      const currentIdx = flatOptions?.findIndex(o => o.value === value);
      calculatePosition();
      setIsOpen(true);
      justOpenedByFocus.current = true;
      // Highlight no valor atual, ou -1 se não houver valor
      setHighlightedIndex(currentIdx >= 0 ? currentIdx : -1);
      // Reset flag após pequeno delay
      setTimeout(() => { justOpenedByFocus.current = false; }, 100);
    }
  };

  const handleClick = () => {
    if (disabled) return;
    // Se acabou de abrir por foco, ignora este clique
    if (justOpenedByFocus.current) return;
    setIsOpen(!isOpen);
  };

  const calculatePosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownHeight = 250; // max-h-[250px]
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      // Se não cabe embaixo, abre em cima
      const openAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;
      
      setDropdownStyle({
        position: 'fixed',
        left: rect.left,
        top: openAbove ? rect.top - dropdownHeight : rect.bottom,
        width: rect.width,
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
                        <span className="truncate">{opt.label}</span>
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
  showTotals?: boolean;
  onColumnsChange?: (columns: ColumnDef[]) => void;
  onColumnWidthsChange?: (widths: Record<string, number>) => void;
  savedColumnWidths?: Record<string, number>;
}

interface EditingRow {
  id: string; data: any; isEditing: boolean; isNew: boolean; isSaving: boolean; errors: Record<string, string>;
}

export default function InlineEditableTable({
  resource, title, columns, autoFocusSearch = true, defaultSort = {}, defaultLimit = 30, enableCreate = true, enableDelete = true,
  formOptions = { categories: [], incomeCategories: [], expenseCategories: [], institutions: [], cards: [], centers: [], suppliers: [], subcategories: {} },
  showTotals = true, onRowSave, onRowCreate, onRowDelete, onColumnsChange, onColumnWidthsChange, savedColumnWidths,
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
  
  const { showMessage } = useMessageContext();
  const { showPopup } = usePopupContext();
  
  const { filters: dynamicFilters, searchFields, isLoading: isLoadingFilters } = useDynamicFilters(`/${resource}/filters`, appliedFilters);
  const { state, data, isLoading: isLoadingData, updateState, refreshData } = useOptimizedTableData(resource, {
    page: 1, limit: defaultLimit, search: "", sort: defaultSort, filters: {}
  });

  const dataColumns = useMemo(() => columns.filter(col => col.field !== "actions" && col.type !== "custom"), [columns]);

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
      
      return (
        <span 
          className="block whitespace-pre-wrap break-words"
          style={{ lineHeight: '14px' }}
        >
          {formattedDesc}
        </span>
      );
    }

    const val = item[field] || getNestedValue(item, field);
    return typeof val === 'object' && !Array.isArray(val) ? formatCellValue(val?.name || val?.description, column) : formatCellValue(val, column);
  }, [formatCellValue, getNestedValue, formOptions]);

  const headers = useMemo(() => dataColumns.map(col => ({ label: col.label, field: col.field, sortParam: col.sortParam || col.field })), [dataColumns]);

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

    setEditingRows(prev => [...prev.filter(r => !r.isNew), {
      id: newRowId,
      data: isNew
        ? { description: '', amount: 0, status: 'PENDING', event_date: new Date().toISOString().split('T')[0], effective_date: new Date().toISOString().split('T')[0], category_id: '', financial_institution_id: '', card_id: '', center_id: '', supplier_id: '', subcategory_id: '' }
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
  }, [items]);

  const saveEditingRow = useCallback(async (id: string) => {
    const row = editingRows.find(r => r.id === id);
    if (!row) return;
    const errors = validateEditingRow(row);
    if (Object.keys(errors).length > 0) return setEditingRows(prev => prev.map(r => r.id === id ? { ...r, errors } : r));

    setEditingRows(prev => prev.map(r => r.id === id ? { ...r, isSaving: true } : r));
    try {
      const payload = { 
        ...row.data, 
        amount: typeof row.data.amount === 'number' ? row.data.amount : parseCurrencyFromPTBR(row.data.amount), 
        card_id: row.data.card_id || null, 
        center_id: row.data.center_id || null,
        supplier_id: row.data.supplier_id || null,
        subcategory_id: row.data.subcategory_id || null
      };
      
      if (row.isNew && onRowCreate) await onRowCreate(payload);
      else if (!row.isNew && onRowSave) await onRowSave(id, payload);
      
      showMessage(`Lançamento ${row.isNew ? 'criado' : 'atualizado'} com sucesso!`, 'success');
      setEditingRows(prev => prev.filter(r => r.id !== id));
      refreshData();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Erro ao salvar', 'error');
      setEditingRows(prev => prev.map(r => r.id === id ? { ...r, isSaving: false } : r));
    }
  }, [editingRows, validateEditingRow, onRowCreate, onRowSave, refreshData, showMessage]);

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
        // Máscara pt-BR em tempo real, baseada em centavos.
        // Estado pode ser número (valor inicial / após blur) ou string mascarada (durante digitação).
        const amountDisplay = typeof val === 'number'
          ? (val > 0 ? maskCurrencyInput(Math.round(val * 100).toString()) : '')
          : (val ?? '');
        return renderWrapper(
          <input
            type="text"
            inputMode="numeric"
            value={amountDisplay}
            onChange={e => {
              upd(maskCurrencyInput(e.target.value));
            }}
            onBlur={e => {
              upd(parseCurrencyFromPTBR(e.target.value));
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
      <div className="flex justify-between items-center gap-3 mb-1 flex-wrap lg:flex-nowrap">
        {/* Esquerda: Botões de ação + Pesquisa em linha única */}
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap sm:flex-nowrap">
          {selectedCheckboxes.length > 0 ? (
            enableDelete && <button onClick={handleDeleteSelected} className="bg-surface-subtle p-2 rounded hover:bg-red-100 transition-colors"><Trash2 size={20} color="var(--color-error)" /></button>
          ) : (
            <>
              {enableCreate && <button onClick={() => startEditingRow('new', true)} className="bg-surface-subtle p-2 rounded hover:bg-ui-border transition-colors"><Plus size={20} color="var(--color-text-muted)" /></button>}
              <button
                onClick={() => setIsColumnModalOpen(true)}
                className="p-2 hover:bg-surface-subtle rounded transition-colors"
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
            >
              <Calendar size={14} className="text-content-muted" />
              <span className="text-content-secondary font-medium">
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
              <div className="absolute top-full left-0 mt-2 bg-surface rounded-xl shadow-2xl border border-ui-border-soft p-3 z-50 w-[320px] max-h-[85vh] overflow-y-auto">
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
                    if (range.from && range.to && range.from !== range.to) {
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
          >
            <span>Limpar</span>
            <X size={12} />
          </button>
          {filterVisible && <DynamicFilterModal visible={filterVisible} setVisible={setFilterVisible} onApply={handleApplyFilters} onClear={handleClearFilters} title={title} filters={dynamicFilters} initialValues={appliedFilters} columns={4} maxHeight={title === 'Lançamentos' ? '90vh' : undefined} excludeFieldsFromCount={['event_date', 'effective_date']} />}
          
          {/* Pesquisa logo após Limpar */}
          <div className="w-[200px] sm:w-[250px] lg:w-[300px]">
            <SearchInput initialValue={state.search} onSearch={s => updateState({ search: s, page: 1 })} placeholder={`Pesquisar ${title.toLowerCase()}...`} delay={600} autoFocus={autoFocusSearch} />
          </div>
          <SelectLimit limit={state.limit} onLimitChange={l => updateState({ limit: l, page: 1 })} />
        </div>

        {/* Direita: Ícones + Saldo */}
        <div className="flex items-center gap-2 flex-shrink-0">
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
            <div className="flex items-center bg-surface-subtle px-3 py-1.5 rounded-lg border border-ui-border-soft">
              <span className="text-xs text-content-secondary mr-1.5">Saldo:</span>
              <span className={`text-sm font-semibold ${totals.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(totals.balance)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Container da tabela com altura fixa e rodapé fixo */}
      <div className="relative">
        {/* Tabela com scroll */}
        <div ref={tableContainerRef} className="overflow-x-auto rounded-lg shadow-sm max-h-[calc(100vh-280px)] overflow-y-auto">
        <TableInformations
          headers={headers}
          sort={state.sort}
          onSort={s => updateState({ sort: { [s]: state.sort[s] === "desc" ? "asc" : "desc" }, page: 1 })}
          onSelectAll={e => setSelectedCheckboxes(e.target.checked ? displayItems.map((i: any) => i.id) : [])}
          allSelected={selectedCheckboxes.length === displayItems.length && displayItems.length > 0}
          hasActions={true}
          columnWidths={columnWidths}
          onMouseDownResize={handleMouseDownResize}
          onColumnReorder={handleColumnReorder}
          tbodyRef={tableBodyRef}
        >
          {displayItems.map((item: any) => {
            const editingRow = editingRows.find(row => row.id === item.id);
            const isEditing = !!editingRow?.isEditing;
            
            return (
              <tr key={item.id} className={`bg-surface hover:bg-surface-subtle border-b border-ui-border-soft text-content-secondary h-auto ${isEditing ? 'bg-brand/5 border-brand/20' : ''}`} style={maxRowHeight ? { height: `${maxRowHeight}px` } : undefined}>
                {dataColumns.map((col, idx) => (
                  <td key={col.field} className={`align-middle border-r border-ui-border-soft p-0 ${isEditing ? 'bg-transparent' : ''}`} style={{ width: 'auto', minWidth: 'fit-content' }}>
                    <div className={`flex w-full items-center px-0.5 py-0 ${idx === 0 ? 'justify-start' : 'justify-center'}`}>
                      {idx === 0 && enableDelete && !isEditing && <input type="checkbox" className="mr-2 inp-checkbox-select rounded border-ui-border cursor-pointer w-4 h-4" checked={selectedCheckboxes.includes(item.id)} onChange={() => setSelectedCheckboxes(p => p.includes(item.id) ? p.filter(id => id !== item.id) : [...p, item.id])} />}
                      <div className={`w-full min-w-0 text-xs ${idx === 0 || col.align === 'left' ? 'text-left' : col.align === 'right' ? 'text-right' : 'text-center'}`}>{renderEditableCell(item, col, editingRow)}</div>
                    </div>
                  </td>
                ))}
                <td className="px-0.5 sticky right-0 bg-surface z-20 border-l border-ui-border-soft align-middle w-auto min-w-fit">
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
      <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-ui-border-soft px-4 py-2 z-50 shadow-lg">
        <div className="flex flex-wrap justify-end items-end gap-2 max-w-[1400px] mx-auto">
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
        onSubmit={async (data) => {
          try {
            const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';
            
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
              // Despesa recorrente - amount é o valor mensal
              const installmentAmount = parseCurrencyFromPTBR(data.amount);
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
                installment_amount: installmentAmount,
                num_installments: parseInt(data.numInstallments),
                total_amount: installmentAmount * parseInt(data.numInstallments),
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
      />
    </>
  );
}