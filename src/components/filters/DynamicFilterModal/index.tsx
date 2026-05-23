/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Check, Calendar } from "lucide-react";
import CalendarPicker from "@/components/ui/CalendarPicker";
import { parseCurrencyFromPTBR } from "@/utils/formatters";
import { maskMoney } from "@/utils/masks";

const formatCurrencyRealtime = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length === 0) return '';

  const trimmedNumbers = numbers.replace(/^0+/, '') || '0';
  const amount = parseInt(trimmedNumbers) / 100;

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// Definição do tipo corrigido
export interface DynamicFilter {
  field: string;
  type: 'string' | 'date' | 'enum' | 'number' | 'boolean' | 'select' | 'currency';
  label: string;
  description: string;
  searchable?: boolean;
  autocomplete?: boolean;
  inputType?: string;
  values?: any[];
  options?: any[];
  min?: string;
  max?: string;
  dateRange?: boolean;
}

interface DynamicFilterModalProps {
  visible: boolean;
  setVisible: (visible: boolean) => void;
  onApply: (filters: Record<string, any>) => void;
  onClear: () => void;
  title: string;
  filters: DynamicFilter[];
  initialValues?: Record<string, any>;
  columns?: 1 | 2 | 3 | 4 | 5;
  maxHeight?: string;
  excludeFieldsFromCount?: string[];
}

interface FilterValue {
  value: any;
  value2?: any;
  values?: any[];
  showDropdown?: boolean;
}

// Funções para formatação de telefone
const removePhoneMask = (value: string): string => {
  if (!value) return '';
  return value.replace(/\D/g, '');
};

const formatPhone = (phone: string | null | undefined): string => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  else if (cleaned.length === 11) return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  else if (cleaned.length === 12) return cleaned.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4');
  else if (cleaned.length === 13) return cleaned.replace(/(\d{3})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4');
  return phone;
};

const isPhoneField = (fieldName: string): boolean => {
  const phoneFields = [
    'telephone', 'phone', 'cellphone', 'mobile', 'celular',
    'whatsapp', 'contact_phone', 'contact_cellphone', 'mobile_phone',
    'home_phone', 'work_phone', 'office_phone', 'business_phone'
  ];
  return phoneFields.some(phoneField => fieldName.toLowerCase().includes(phoneField.toLowerCase()));
};

const isCurrencyField = (fieldName: string, type?: string): boolean => {
  if (type === 'currency') return true;
  const currencyFields = [
    'value', 'price', 'amount', 'total', 'tax', 'fee', 'valor', 'preco', 'custo', 'pagamento',
    'cota', 'parcela', 'iptu', 'condo_fee', 'property_tax', 'purchase_value', 'rental_value', 'sale_value', 'market_value'
  ];
  return currencyFields.some(currencyField => fieldName.toLowerCase().includes(currencyField.toLowerCase()));
};

const updateDropdownPosition = (field: string, inputRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>, dropdownRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>) => {
  const inputEl = inputRefs.current[field];
  const dropdownEl = dropdownRefs.current[field];

  if (inputEl && dropdownEl) {
    const rect = inputEl.getBoundingClientRect();
    dropdownEl.style.top = (rect.bottom + 4) + 'px';
    dropdownEl.style.left = rect.left + 'px';
    dropdownEl.style.width = rect.width + 'px';
  }
};

// Componente de filtro de data com botão que abre o calendário
interface DateRangeFilterProps {
  filter: DynamicFilter;
  filterValue: FilterValue;
  onChange: (from: string, to: string) => void;
}

function DateRangeFilter({ filterValue, onChange }: DateRangeFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  // Calcular posição do dropdown
  const calculatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    
    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownWidth = 320;
    const dropdownHeight = 380; // altura aproximada do calendário
    const margin = 8;
    
    // Calcular espaço disponível
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const viewportWidth = window.innerWidth;
    
    // Decidir se mostra acima ou abaixo
    let top: number;
    const showAbove = spaceBelow < dropdownHeight && spaceAbove > dropdownHeight;
    
    if (showAbove) {
      top = Math.max(margin, rect.top - dropdownHeight - margin);
    } else {
      top = Math.min(rect.bottom + margin, window.innerHeight - dropdownHeight - margin);
    }
    
    // Calcular left alinhado com o botão, mas garantindo que não saia da tela
    let left = rect.left;
    
    // Se ultrapassar a borda direita, alinhar pela direita do botão
    if (left + dropdownWidth > viewportWidth - margin) {
      left = Math.max(margin, rect.right - dropdownWidth);
    }
    
    // Se ainda ultrapassar, colocar no máximo possível
    if (left < margin) {
      left = margin;
    }
    
    // Garantir que não saia pela direita
    if (left + dropdownWidth > viewportWidth - margin) {
      left = viewportWidth - dropdownWidth - margin;
    }
    
    setDropdownPosition({ top, left });
  }, []);

  // Atualizar posição ao abrir e ao redimensionar
  useEffect(() => {
    if (isOpen) {
      calculatePosition();
      window.addEventListener('resize', calculatePosition);
      window.addEventListener('scroll', calculatePosition, true);
      return () => {
        window.removeEventListener('resize', calculatePosition);
        window.removeEventListener('scroll', calculatePosition, true);
      };
    }
  }, [isOpen, calculatePosition]);

  // Fechar ao clicar fora
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current && !buttonRef.current.contains(target)) {
        const dropdownEl = document.querySelector('[data-date-range-dropdown]');
        if (!dropdownEl || !dropdownEl.contains(target)) {
          setIsOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Helper para converter string de data para Date local (sem timezone issues)
  const parseDateString = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const hasValue = filterValue.value && filterValue.value2;
  const displayText = hasValue
    ? `${parseDateString(filterValue.value).toLocaleDateString('pt-BR')} - ${parseDateString(filterValue.value2).toLocaleDateString('pt-BR')}`
    : 'Selecionar período';

  return (
    <div className="relative">
      <button
        type="button"
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 h-10 bg-surface border border-ui-border rounded-lg hover:border-brand transition-colors text-sm"
      >
        <Calendar size={16} className="text-content-muted flex-shrink-0" />
        <span className={`truncate ${hasValue ? 'text-content' : 'text-content-muted'}`}>
          {displayText}
        </span>
      </button>

      {isOpen && createPortal(
        <div
          data-date-range-dropdown
          className="bg-surface rounded-xl shadow-2xl border border-ui-border-soft p-3 overflow-y-auto"
          style={{
            position: 'fixed',
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: '320px',
            minWidth: '280px',
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 'min(85vh, 500px)',
            zIndex: 9999,
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-ui-border-soft">
            <span className="text-sm font-medium text-content">Selecione o período</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-surface-subtle rounded transition-colors"
            >
              <X size={18} className="text-content-muted" />
            </button>
          </div>
          <CalendarPicker
            dateRange={{ from: filterValue.value || '', to: filterValue.value2 || '' }}
            onChange={(range) => {
              onChange(range.from, range.to);
              if (range.from && range.to && range.from !== range.to) {
                setIsOpen(false);
              }
            }}
          />
        </div>,
        document.body
      )}
    </div>
  );
}

export default function DynamicFilterModal({
  visible, setVisible, onApply, onClear, title, filters, initialValues = {}, columns, maxHeight, excludeFieldsFromCount = []
}: DynamicFilterModalProps) {
  const [localFilters, setLocalFilters] = useState<Record<string, FilterValue>>({});
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const visibleFilters = useMemo(() => filters, [filters]);

  // Função para pegar o Label a partir de um Value (ID) na inicialização
  const getLabelForValue = useCallback((filter: DynamicFilter, val: any): string => {
    if (filter.type === 'select' && (filter.options || filter.values)) {
      const options = filter.options || filter.values || [];
      const match = options.find((opt: any) => typeof opt === 'object' && opt !== null && String(opt.value) === String(val));
      if (match) return match.label;
    }
    return String(val);
  }, []);

  useEffect(() => {
    if (visible) {
      const newFilters: Record<string, FilterValue> = {};
      const newSearchTerms: Record<string, string> = {};

      visibleFilters.forEach(filter => {
        const initialValue = initialValues[filter.field];
        const isPhone = isPhoneField(filter.field);
        const isCurrency = isCurrencyField(filter.field, filter.type);

        if (filter.dateRange) {
          if (initialValue && typeof initialValue === 'object' && 'from' in initialValue && 'to' in initialValue) {
            newFilters[filter.field] = { value: initialValue.from, value2: initialValue.to, showDropdown: false };
          } else if (initialValue && typeof initialValue === 'string') {
            newFilters[filter.field] = { value: initialValue, value2: '', showDropdown: false };
          } else {
            newFilters[filter.field] = { value: '', value2: '', showDropdown: false };
          }
          newSearchTerms[filter.field] = '';
        } else {
          if (initialValue !== undefined && initialValue !== null && initialValue !== '') {
            if (typeof initialValue === 'object' && ('value' in initialValue || 'values' in initialValue)) {
              const { value, value2, values } = initialValue as any;

              if (isPhone && value) {
                newFilters[filter.field] = { value: removePhoneMask(String(value)), showDropdown: false };
                newSearchTerms[filter.field] = String(value);
              } else if (isCurrency && value) {
                const numericVal = parseCurrencyFromPTBR(value);
                newFilters[filter.field] = { value: numericVal, showDropdown: false };
                newSearchTerms[filter.field] = maskCurrencyInput((numericVal * 100).toFixed(0));
              } else {
                newFilters[filter.field] = { value: value || '', value2: value2 || '', values: values || [], showDropdown: false };
                if (value) {
                  newSearchTerms[filter.field] = getLabelForValue(filter, value);
                }
              }
            } else {
              if (isPhone) {
                newFilters[filter.field] = { value: removePhoneMask(String(initialValue)), showDropdown: false };
                newSearchTerms[filter.field] = String(initialValue);
              } else if (isCurrency) {
                const numericVal = parseCurrencyFromPTBR(initialValue);
                newFilters[filter.field] = { value: numericVal, showDropdown: false };
                newSearchTerms[filter.field] = maskCurrencyInput((numericVal * 100).toFixed(0));
              } else {
                newFilters[filter.field] = { value: initialValue, showDropdown: false };
                newSearchTerms[filter.field] = getLabelForValue(filter, initialValue);
              }
            }
          } else {
            newFilters[filter.field] = { value: '', showDropdown: false };
            newSearchTerms[filter.field] = '';
          }
        }
      });

      setLocalFilters(newFilters);
      setSearchTerms(newSearchTerms);
      setActiveDropdown(null);
    }
  }, [visible, visibleFilters, initialValues, getLabelForValue]);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    const target = event.target as Node;
    let clickedInsideDropdown = false;
    Object.values(dropdownRefs.current).forEach(dropdown => { if (dropdown && dropdown.contains(target)) clickedInsideDropdown = true; });
    Object.values(inputRefs.current).forEach(input => { if (input && input.contains(target)) clickedInsideDropdown = true; });

    // Verificar se clicou no dropdown de data (que está em portal fora do modal)
    const dateRangeDropdown = document.querySelector('[data-date-range-dropdown]');
    if (dateRangeDropdown && dateRangeDropdown.contains(target)) {
      clickedInsideDropdown = true;
    }

    if (!clickedInsideDropdown && activeDropdown) {
      setLocalFilters(prev => ({ ...prev, [activeDropdown]: { ...prev[activeDropdown], showDropdown: false } }));
      setActiveDropdown(null);
    }
    if (modalRef.current && !modalRef.current.contains(target) && !clickedInsideDropdown) setVisible(false);
  }, [activeDropdown, setVisible]);

  useEffect(() => {
    if (visible) document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, [visible, handleClickOutside]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && activeDropdown) {
        setLocalFilters(prev => ({ ...prev, [activeDropdown]: { ...prev[activeDropdown], showDropdown: false } }));
        setActiveDropdown(null);
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [activeDropdown]);

  useEffect(() => {
    if (!activeDropdown) return;

    const updateAllDropdownPositions = () => {
      updateDropdownPosition(activeDropdown, inputRefs, dropdownRefs);
    };

    const scrollHandler = () => updateAllDropdownPositions();
    const resizeHandler = () => updateAllDropdownPositions();

    contentRef.current?.addEventListener('scroll', scrollHandler, true);
    window.addEventListener('resize', resizeHandler);

    setTimeout(updateAllDropdownPositions, 0);

    return () => {
      contentRef.current?.removeEventListener('scroll', scrollHandler, true);
      window.removeEventListener('resize', resizeHandler);
    };
  }, [activeDropdown]);

  // Modificado para aceitar o displayLabel
  const updateFilterValue = useCallback((field: string, key: keyof FilterValue, value: any, displayLabel?: string) => {
    setLocalFilters(prev => {
      const current = prev[field] || {};
      const updatedValue = { ...current, [key]: value, showDropdown: false };
      return { ...prev, [field]: updatedValue };
    });

    if (key === 'value' && value !== '') {
      const filter = visibleFilters.find(f => f.field === field);
      if (!filter?.dateRange) {
        setSearchTerms(prev => ({
          ...prev,
          [field]: displayLabel !== undefined ? displayLabel : String(value)
        }));
      }
    }

    if (activeDropdown === field) setActiveDropdown(null);
  }, [activeDropdown, visibleFilters]);

  const handleApply = () => {
    const simplifiedFilters: Record<string, any> = {};
    Object.entries(localFilters).forEach(([field, filterValue]) => {
      if (!filterValue) return;
      const filterConfig = visibleFilters.find(f => f.field === field);
      if (filterConfig?.dateRange) {
        const hasFrom = filterValue.value !== undefined && filterValue.value !== null && filterValue.value !== '';
        const hasTo = filterValue.value2 !== undefined && filterValue.value2 !== null && filterValue.value2 !== '';
        if (hasFrom && hasTo) simplifiedFilters[field] = { from: filterValue.value, to: filterValue.value2 };
        else if (hasFrom) simplifiedFilters[field] = filterValue.value;
      } else {
        const hasValue = filterValue.value !== undefined && filterValue.value !== null && filterValue.value !== '' || (filterValue.values && filterValue.values.length > 0);
        if (hasValue) {
          if (filterValue.values && filterValue.values.length > 0) simplifiedFilters[field] = filterValue.values;
          else if (filterValue.value !== '' && filterValue.value !== null && filterValue.value !== undefined) {
            if (isPhoneField(field)) simplifiedFilters[field] = removePhoneMask(String(filterValue.value));
            else simplifiedFilters[field] = filterValue.value;
          }
        }
      }
    });
    onApply(simplifiedFilters);
  };

  const handleClear = () => {
    const clearedFilters: Record<string, FilterValue> = {};
    const clearedSearchTerms: Record<string, string> = {};
    visibleFilters.forEach(filter => {
      clearedFilters[filter.field] = { value: '', value2: '', values: [], showDropdown: false };
      clearedSearchTerms[filter.field] = '';
    });
    setLocalFilters(clearedFilters);
    setSearchTerms(clearedSearchTerms);
    setActiveDropdown(null);
    onClear();
  };

  const handleInputFocus = useCallback((field: string) => {
    const filter = visibleFilters.find(f => f.field === field);
    if (filter?.autocomplete || filter?.options || filter?.values) {
      if (activeDropdown && activeDropdown !== field) {
        setLocalFilters(prev => ({ ...prev, [activeDropdown]: { ...prev[activeDropdown], showDropdown: false } }));
      }
      setLocalFilters(prev => ({ ...prev, [field]: { ...(prev[field] || {}), showDropdown: true } }));
      setActiveDropdown(field);
    }
  }, [activeDropdown, visibleFilters]);

  const handleInputBlur = useCallback((field: string) => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => {
      setLocalFilters(prev => ({ ...prev, [field]: { ...(prev[field] || {}), showDropdown: false } }));
      if (activeDropdown === field) setActiveDropdown(null);
    }, 200);
  }, [activeDropdown]);

  // Modificado para aceitar o displayLabel da opção clicada
  const handleOptionClick = useCallback((field: string, value: any, displayLabel?: string) => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    const filter = visibleFilters.find(f => f.field === field);
    const isPhone = isPhoneField(field);
    const isCurrency = isCurrencyField(field, filter?.type);

    let valueToStore = value;
    if (isPhone && (filter?.autocomplete || filter?.options || filter?.values)) {
      valueToStore = removePhoneMask(String(value));
    } else if (isCurrency && (filter?.autocomplete || filter?.options || filter?.values)) {
      valueToStore = parseCurrencyFromPTBR(String(value));
    }

    updateFilterValue(field, 'value', valueToStore, displayLabel);
  }, [updateFilterValue, visibleFilters]);

  const getFilteredSuggestions = (field: string) => {
    const filter = visibleFilters.find(f => f.field === field);
    const searchTerm = searchTerms[field]?.toLowerCase() || '';
    if (!filter) return [];

    const source = filter.options || filter.values || [];

    if (filter.type === 'select' && source.length > 0 && typeof source[0] === 'object') {
      const objectSource = source as Array<{ value: any; label: string }>;
      if (searchTerm) return objectSource.filter((item: { value: any; label: string }) => item.label.toLowerCase().includes(searchTerm));
      return objectSource;
    }

    if (searchTerm) return source.filter((item: any) => String(item).toLowerCase().includes(searchTerm));
    return source;
  };

  const renderFilterInput = (filter: DynamicFilter) => {
    const filterValue = localFilters[filter.field] || { value: '', showDropdown: false };
    const searchTerm = searchTerms[filter.field] || '';
    const suggestions = getFilteredSuggestions(filter.field);
    const hasSuggestions = suggestions.length > 0;
    const isDropdownOpen = Boolean(filterValue.showDropdown) && activeDropdown === filter.field;
    const isPhone = isPhoneField(filter.field);
    const hasOptions = filter.autocomplete || filter.options || filter.values;

    const isCurrency = isCurrencyField(filter.field, filter.type);

    return (
      <div className="relative flex flex-col gap-1" key={filter.field}>
        <label className="block text-sm font-medium text-content-secondary truncate">
          {filter.label}
        </label>

        {filter.dateRange ? (
          <DateRangeFilter
            filter={filter}
            filterValue={filterValue}
            onChange={(from, to) => {
              updateFilterValue(filter.field, 'value', from);
              updateFilterValue(filter.field, 'value2', to);
            }}
          />
        ) : (
          <div className="relative">
            <div className="relative">
              <input
                ref={(el) => { if (el) inputRefs.current[filter.field] = el; }}
                type={filter.inputType || 'text'}
                className="w-full border border-ui-border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent pr-10 h-10"
                value={isCurrency ? searchTerm : (isPhone && hasOptions ? searchTerm : (isPhone ? formatPhone(searchTerm) : searchTerm))}
                onChange={(e) => {
                  const value = e.target.value;
                  let cleanedValue: any = value;
                  let newSearchTerm = value;

                  if (isPhone) {
                    cleanedValue = removePhoneMask(value);
                  } else if (isCurrency) {
                    newSearchTerm = formatCurrencyRealtime(value);
                    cleanedValue = parseCurrencyFromPTBR(newSearchTerm);
                  }

                  setSearchTerms(prev => ({ ...prev, [filter.field]: newSearchTerm }));
                  setLocalFilters(prev => ({
                    ...prev,
                    [filter.field]: { ...(prev[filter.field] || {}), value: cleanedValue, showDropdown: Boolean(newSearchTerm.length > 0 && hasOptions) }
                  }));

                  if (newSearchTerm.length > 0 && hasOptions) handleInputFocus(filter.field);
                }}
                onFocus={() => handleInputFocus(filter.field)}
                onBlur={() => handleInputBlur(filter.field)}
                placeholder={isCurrency ? "0,00" : (isPhone ? "Ex: (11) 99999-9999" : `Digite...`)}
              />

              {hasOptions && !isPhone && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2"
                  onClick={(e) => {
                    e.preventDefault();
                    if (isDropdownOpen) {
                      setLocalFilters(prev => ({ ...prev, [filter.field]: { ...(prev[filter.field] || {}), showDropdown: false } }));
                      setActiveDropdown(null);
                    } else {
                      handleInputFocus(filter.field);
                      inputRefs.current[filter.field]?.focus();
                    }
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <svg className={`w-4 h-4 text-content-placeholder transition-transform ${isDropdownOpen ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}
            </div>

            {isDropdownOpen && hasOptions && createPortal(
              <div
                ref={(el) => {
                  if (el) dropdownRefs.current[filter.field] = el;
                }}
                className="bg-surface border border-ui-border rounded-lg shadow-lg max-h-60 overflow-y-auto"
                style={{
                  position: 'fixed',
                  zIndex: 9999,
                }}
                onMouseDown={(e) => e.preventDefault()}
              >
                {hasSuggestions ? (
                  suggestions.map((suggestion, index) => {
                    if (filter.type === 'select' && suggestion && typeof suggestion === 'object') {
                      const { label, value } = suggestion as { value: any; label: string };
                      return (
                        <div
                          key={index}
                          className="px-3 py-2 hover:bg-surface-subtle cursor-pointer text-sm"
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleOptionClick(filter.field, value, label); }}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleOptionClick(filter.field, value, label); }}
                        >
                          {label}
                        </div>
                      );
                    }

                    let formattedLabel = String(suggestion);
                    if (isCurrency && !isNaN(Number(suggestion))) {
                      formattedLabel = maskCurrencyInput((Number(suggestion) * 100).toFixed(0));
                    }

                    return (
                      <div
                        key={index}
                        className="px-3 py-2 hover:bg-surface-subtle cursor-pointer text-sm"
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleOptionClick(filter.field, suggestion, formattedLabel); }}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleOptionClick(filter.field, suggestion, formattedLabel); }}
                      >
                        {formattedLabel}
                      </div>
                    );
                  })
                ) : (
                  <div className="px-3 py-2 text-sm text-content-muted">Nenhuma opção disponível</div>
                )}
              </div>,
              document.body
            )}
          </div>
        )}

      </div>
    );
  };

  const getActiveFilterCount = () => {
    return Object.entries(localFilters).filter(([field, filter]) => {
      if (excludeFieldsFromCount.includes(field)) return false;
      return filter && ((filter.value !== undefined && filter.value !== null && filter.value !== '') ||
      (filter.values && filter.values.length > 0) ||
      (filter.value2 !== undefined && filter.value2 !== null && filter.value2 !== ''));
    }).length;
  };

  if (!visible) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setVisible(false)} />

      <div
        ref={modalRef}
        className="fixed top-[5%] left-1/2 -translate-x-1/2 z-50 bg-surface rounded-xl shadow-2xl border border-ui-border-soft flex flex-col"
        style={{ width: 'min(90vw, 1400px)', maxHeight: maxHeight || '85vh' }}
      >
        <div className="p-4 flex justify-between items-center border-b border-ui-border-soft flex-shrink-0 bg-surface">
          <div>
            <h3 className="text-lg font-semibold text-content">Filtrar {title}</h3>
            <p className="text-sm text-content-muted mt-1">
              {getActiveFilterCount() > 0 ? `${getActiveFilterCount()} filtro(s) ativo(s)` : "Selecione os critérios de filtro"}
            </p>
          </div>
          <button type="button" onClick={() => setVisible(false)} className="p-2 hover:bg-surface-subtle rounded-lg transition-colors flex-shrink-0" aria-label="Fechar filtro">
            <X size={20} className="text-content-secondary" />
          </button>
        </div>

        <div
          ref={contentRef}
          className={`p-4 grid gap-3 flex-1 min-h-0 overflow-y-auto ${
            columns === 3
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
              : columns === 2
                ? 'grid-cols-1 sm:grid-cols-2'
                : columns === 1
                  ? 'grid-cols-1'
                  : columns === 4
                    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                    : columns === 5
                      ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
          }`}
        >
          {visibleFilters.map((filter) => renderFilterInput(filter))}
        </div>

        <div className="p-4 flex justify-end gap-3 border-t border-ui-border-soft flex-shrink-0 bg-surface">
          <button type="button" onClick={handleClear} className="px-4 py-2 border border-ui-border rounded-lg text-sm font-medium hover:bg-surface-subtle transition-colors">
            Limpar tudo
          </button>
          <button type="button" onClick={handleApply} className="px-4 py-2 bg-gradient-to-r from-brand to-brand-hover text-content-inverse rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2">
            <Check size={16} />
            Aplicar filtros
          </button>
        </div>
      </div>
    </>
  );
}
