/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { 
  Building2, FileText, Phone, MessageCircle, Globe, 
  Home, MapPin, Hash, User, Mail, Calendar, CalendarDays,
  Type, Bed, Bath, Car, Ruler, Sofa, CheckCircle, XCircle,
  DollarSign, Percent, FileDigit, UserCircle, Briefcase,
  Landmark, CreditCard, FileCheck, ClipboardCheck, Building,
  X, Check, 
  Users, Heart, Award, Shield, Lock, Key, Eye,
  Clock, AlertTriangle, Activity, Star, Tag, Layers, Package,
  Truck, ShoppingCart, ShoppingBag, Palette, Scale,
  GraduationCap, School, Hospital, Hotel, Store, Utensils,
  Flower, Droplets, Mountain, Trophy, Target,
  Camera, Video, Printer, Cpu, Server, Database, Table,
  Upload, Download, Save, Edit2, Trash2, PlusCircle, MinusCircle,
  AlertCircle, Info, HelpCircle, Wifi, Radio, Tv, Music,
  Headphones, Mouse, Keyboard, HardDrive, Smartphone,
  Tablet, Monitor, Laptop, Router, Cloud, Sun, Moon,
  Thermometer, Leaf, Apple, Carrot, Coffee,
  Pizza, Cake, Church, Castle, Tent, Ship,
  Plane, Train, Bike, Bus, Compass, Navigation, Map, Earth,
  Medal, Crown, Zap, Scissors, PenTool, Brush, Image, Film,
  Newspaper, File, FolderOpen, Archive, Inbox,
  Send, Share, Copy, Atom, Brain,
  HeartPulse, Stethoscope, Pill, Syringe, Wine, Beer,
  Receipt, Wallet, Coins, Banknote, Bitcoin, Currency,
  ChartBar, ChartLine, ChartArea, ChartPie,
  UmbrellaIcon,
  FlagIcon,
  Trees,
  RotateCcwIcon,
  RefreshCw
} from "lucide-react";

// Definição do tipo corrigido
export interface DynamicFilter {
  field: string;
  type: 'string' | 'date' | 'enum' | 'number' | 'boolean' | 'select';
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
}

interface FilterValue {
  value: any;
  value2?: any;
  values?: any[];
  showDropdown?: boolean;
}

// Funções para formatação de telefone (APENAS para inputs de texto livre)
const removePhoneMask = (value: string): string => {
  if (!value) return '';
  return value.replace(/\D/g, '');
};

const formatPhone = (phone: string | null | undefined): string => {
  if (!phone) return '';
  
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  } else if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  } else if (cleaned.length === 12) {
    return cleaned.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4');
  } else if (cleaned.length === 13) {
    return cleaned.replace(/(\d{3})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4');
  }
  
  return phone;
};

// Verifica se um campo é do tipo telefone/celular
const isPhoneField = (fieldName: string): boolean => {
  const phoneFields = [
    'telephone', 'phone', 'cellphone', 'mobile', 'celular',
    'whatsapp', 'contact_phone', 'contact_cellphone', 'mobile_phone',
    'home_phone', 'work_phone', 'office_phone', 'business_phone'
  ];
  
  return phoneFields.some(phoneField => 
    fieldName.toLowerCase().includes(phoneField.toLowerCase())
  );
};

// Objeto FIELD_ICONS
const FIELD_ICONS: Record<string, any> = {
  'name': User,
  'email': Mail,
  'birth_date': CalendarDays,
  'created_at': Calendar,
  'updated_at': Calendar,
  'gender': UserCircle,
  'title': Type,
  'owner': User,
  'type': Home,
  'city': MapPin,
  'state': MapPin,
  'district': MapPin,
  'street': MapPin,
  'zip_code': Hash,
  'bedrooms': Bed,
  'bathrooms': Bath,
  'half_bathrooms': Bath,
  'garage_spaces': Car,
  'area_total': Ruler,
  'area_built': Ruler,
  'frontage': Ruler,
  'furnished': Sofa,
  'floor_number': Building,
  'tax_registration': Hash,
  'notes': FileText,
  'agency': Building,
  'owner_id': User,
  'type_id': Home,
  'agency_id': Building,
  'trade_name': Building2,
  'legal_name': FileText,
  'cnpj': CreditCard,
  'state_registration': FileCheck,
  'municipal_registration': ClipboardCheck,
  'license_number': FileDigit,
  'contact_name': UserCircle,
  'contact_phone': Phone,
  'contact_email': Mail,
  'whatsapp': MessageCircle,
  'contact_role': Briefcase,
  'contact_department': Building,
  'contact_notes': FileText,
  'telephone': Phone,
  'phone': Phone,
  'cellphone': Phone,
  'mobile': Phone,
  'celular': Phone,
  'number': Hash,
  'country': Globe,
  'status': CheckCircle,
  'active': CheckCircle,
  'inactive': XCircle,
  'value': DollarSign,
  'price': DollarSign,
  'amount': DollarSign,
  'percentage': Percent,
  'rate': Percent,
  'purchase_value': DollarSign,
  'rental_value': DollarSign,
  'condo_fee': DollarSign,
  'property_tax': DollarSign,
  'company': Building2,
  'enterprise': Building2,
  'institution': Landmark,
  'organization': Building2,
  'internal_code': Hash,
  'occupation': Briefcase,
  'marital_status': Heart,
  'cpf': CreditCard,
  'contact': UserCircle,
  'contract_number': FileText,
  'start_date': Calendar,
  'end_date': Calendar,
  'property_title': Home,
  'tenant': Users,
  'rent_amount': DollarSign,
  'extra_charges': DollarSign,
  'commission_amount': DollarSign,
  'rent_due_day': CalendarDays,
  'tax_due_day': CalendarDays,
  'condo_due_day': CalendarDays,
  'description': Type,
  'code': Hash,
  'id': Hash,
  'reference': FileText,
  'document': FileText,
  'category': Tag,
  'default': Type,
};

export default function DynamicFilterModal({ 
  visible, 
  setVisible, 
  onApply, 
  onClear, 
  title,
  filters,
  initialValues = {}
}: DynamicFilterModalProps) {
  const [localFilters, setLocalFilters] = useState<Record<string, FilterValue>>({});
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const visibleFilters = useMemo(() => {
    return filters;
  }, [filters]);

  // Inicializar com valores passados
  useEffect(() => {
    if (visible) {
      const newFilters: Record<string, FilterValue> = {};
      const newSearchTerms: Record<string, string> = {};
      
      visibleFilters.forEach(filter => {
        const initialValue = initialValues[filter.field];
        const isPhone = isPhoneField(filter.field);
        
        if (filter.dateRange) {
          if (initialValue && typeof initialValue === 'object' && 'from' in initialValue && 'to' in initialValue) {
            newFilters[filter.field] = {
              value: initialValue.from,
              value2: initialValue.to,
              showDropdown: false
            };
          } else if (initialValue && typeof initialValue === 'string') {
            newFilters[filter.field] = {
              value: initialValue,
              value2: '',
              showDropdown: false
            };
          } else {
            newFilters[filter.field] = {
              value: '',
              value2: '',
              showDropdown: false,
            };
          }
          newSearchTerms[filter.field] = '';
        } else {
          if (initialValue !== undefined && initialValue !== null && initialValue !== '') {
            if (typeof initialValue === 'object' && ('value' in initialValue || 'values' in initialValue)) {
              const { value, value2, values } = initialValue as any;
              
              if (isPhone && value) {
                newFilters[filter.field] = {
                  value: removePhoneMask(String(value)),
                  showDropdown: false
                };
                newSearchTerms[filter.field] = String(value);
              } else {
                newFilters[filter.field] = {
                  value: value || '',
                  value2: value2 || '',
                  values: values || [],
                  showDropdown: false
                };
                if (value) {
                  newSearchTerms[filter.field] = String(value);
                }
              }
            } else {
              if (isPhone) {
                newFilters[filter.field] = {
                  value: removePhoneMask(String(initialValue)),
                  showDropdown: false
                };
                newSearchTerms[filter.field] = String(initialValue);
              } else {
                newFilters[filter.field] = {
                  value: initialValue,
                  showDropdown: false
                };
                newSearchTerms[filter.field] = String(initialValue);
              }
            }
          } else {
            newFilters[filter.field] = {
              value: '',
              showDropdown: false,
            };
            newSearchTerms[filter.field] = '';
          }
        }
      });
      
      console.log('🔄 Inicializando filtros locais:', newFilters);
      setLocalFilters(newFilters);
      setSearchTerms(newSearchTerms);
      setActiveDropdown(null);
    }
  }, [visible, visibleFilters, initialValues]);

  // Fechar dropdowns ao clicar fora
  const handleClickOutside = useCallback((event: MouseEvent) => {
    let clickedInsideDropdown = false;
    
    Object.values(dropdownRefs.current).forEach(dropdown => {
      if (dropdown && dropdown.contains(event.target as Node)) {
        clickedInsideDropdown = true;
      }
    });
    
    Object.values(inputRefs.current).forEach(input => {
      if (input && input.contains(event.target as Node)) {
        clickedInsideDropdown = true;
      }
    });
    
    if (!clickedInsideDropdown && activeDropdown) {
      setLocalFilters(prev => ({
        ...prev,
        [activeDropdown]: {
          ...prev[activeDropdown],
          showDropdown: false
        }
      }));
      setActiveDropdown(null);
    }
    
    if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
      setVisible(false);
    }
  }, [activeDropdown, setVisible]);

  useEffect(() => {
    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, [visible, handleClickOutside]);

  // Fechar dropdown quando pressionar ESC
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && activeDropdown) {
        setLocalFilters(prev => ({
          ...prev,
          [activeDropdown]: {
            ...prev[activeDropdown],
            showDropdown: false
          }
        }));
        setActiveDropdown(null);
      }
    };

    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [activeDropdown]);

  const updateFilterValue = useCallback((field: string, key: keyof FilterValue, value: any) => {
    setLocalFilters(prev => {
      const current = prev[field] || {};
      const updatedValue = {
        ...current,
        [key]: value,
        showDropdown: false
      };
      
      if (updatedValue.showDropdown !== undefined && typeof updatedValue.showDropdown !== 'boolean') {
        updatedValue.showDropdown = false;
      }
      
      return {
        ...prev,
        [field]: updatedValue
      };
    });
    
    if (key === 'value' && value !== '') {
      const filter = visibleFilters.find(f => f.field === field);
      if (!filter?.dateRange) {
        setSearchTerms(prev => ({
          ...prev,
          [field]: String(value)
        }));
      }
    }
    
    if (activeDropdown === field) {
      setActiveDropdown(null);
    }
  }, [activeDropdown, visibleFilters]);

  const handleApply = () => {
    const simplifiedFilters: Record<string, any> = {};
    
    Object.entries(localFilters).forEach(([field, filterValue]) => {
      if (!filterValue) return;
      
      const filterConfig = visibleFilters.find(f => f.field === field);
      
      if (filterConfig?.dateRange) {
        const hasFrom = filterValue.value !== undefined && filterValue.value !== null && filterValue.value !== '';
        const hasTo = filterValue.value2 !== undefined && filterValue.value2 !== null && filterValue.value2 !== '';
        
        if (hasFrom && hasTo) {
          simplifiedFilters[field] = {
            from: filterValue.value,
            to: filterValue.value2
          };
        } else if (hasFrom) {
          simplifiedFilters[field] = filterValue.value;
        }
      } else {
        const hasValue = filterValue.value !== undefined && 
                        filterValue.value !== null && 
                        filterValue.value !== '' ||
                        (filterValue.values && filterValue.values.length > 0);
        
        if (hasValue) {
          if (filterValue.values && filterValue.values.length > 0) {
            simplifiedFilters[field] = filterValue.values;
          } else if (filterValue.value !== '' && filterValue.value !== null && filterValue.value !== undefined) {
            if (isPhoneField(field)) {
              simplifiedFilters[field] = removePhoneMask(String(filterValue.value));
            } else {
              simplifiedFilters[field] = filterValue.value;
            }
          }
        }
      }
    });

    console.log('✅ Aplicando filtros:', simplifiedFilters);
    onApply(simplifiedFilters);
  };

  const handleClear = () => {
    const clearedFilters: Record<string, FilterValue> = {};
    const clearedSearchTerms: Record<string, string> = {};
    
    visibleFilters.forEach(filter => {
      clearedFilters[filter.field] = {
        value: '',
        value2: '',
        values: [],
        showDropdown: false,
      };
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
        setLocalFilters(prev => ({
          ...prev,
          [activeDropdown]: {
            ...prev[activeDropdown],
            showDropdown: false
          }
        }));
      }
      
      setLocalFilters(prev => ({
        ...prev,
        [field]: {
          ...(prev[field] || {}),
          showDropdown: true
        }
      }));
      setActiveDropdown(field);
    }
  }, [activeDropdown, visibleFilters]);

  const handleInputBlur = useCallback((field: string) => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    
    closeTimeoutRef.current = setTimeout(() => {
      setLocalFilters(prev => ({
        ...prev,
        [field]: {
          ...(prev[field] || {}),
          showDropdown: false
        }
      }));
      
      if (activeDropdown === field) {
        setActiveDropdown(null);
      }
    }, 200);
  }, [activeDropdown]);

  const handleOptionClick = useCallback((field: string, value: any) => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    
    const filter = visibleFilters.find(f => f.field === field);
    const isPhone = isPhoneField(field);
    
    // Para campos de telefone em dropdowns, os valores já vêm formatados do back-end
    // Então armazenamos sem máscara, mas mantemos a formatação para exibição
    let valueToStore = value;
    if (isPhone && (filter?.autocomplete || filter?.options || filter?.values)) {
      valueToStore = removePhoneMask(String(value));
    }
    
    updateFilterValue(field, 'value', valueToStore);
    
    if (!filter?.dateRange) {
      // Para campos de telefone com opções, mantemos o valor formatado para exibição
      if (isPhone && (filter?.autocomplete || filter?.options || filter?.values)) {
        setSearchTerms(prev => ({
          ...prev,
          [field]: String(value) // Mantém o valor formatado original
        }));
      }
    }
  }, [updateFilterValue, visibleFilters]);

  const getFilterIcon = (field: string) => {
    if (FIELD_ICONS[field]) {
      const Icon = FIELD_ICONS[field];
      return <Icon size={16} className="text-content-muted" />;
    }
    
    const fieldLower = field.toLowerCase();
    
    const keywordMap = [
      { keywords: ['name', 'nome', 'pessoa'], icon: User },
      { keywords: ['email', 'e-mail'], icon: Mail },
      { keywords: ['date', 'data', 'dia'], icon: Calendar },
      { keywords: ['phone', 'telefone', 'celular', 'fone', 'cellphone'], icon: Phone },
      { keywords: ['address', 'endereco', 'rua', 'logradouro'], icon: MapPin },
      { keywords: ['city', 'cidade'], icon: MapPin },
      { keywords: ['state', 'estado', 'uf'], icon: MapPin },
      { keywords: ['zip', 'cep'], icon: Hash },
      { keywords: ['code', 'codigo', 'id'], icon: Hash },
      { keywords: ['number', 'numero', 'num'], icon: Hash },
      { keywords: ['value', 'valor', 'price', 'preco', 'amount', 'montante'], icon: DollarSign },
      { keywords: ['percent', 'porcentagem', 'rate', 'taxa'], icon: Percent },
      { keywords: ['status', 'estado'], icon: CheckCircle },
      { keywords: ['active', 'ativo'], icon: CheckCircle },
      { keywords: ['inactive', 'inativo'], icon: XCircle },
      { keywords: ['description', 'descricao'], icon: Type },
      { keywords: ['note', 'observacao', 'obs'], icon: FileText },
      { keywords: ['document', 'documento'], icon: FileText },
      { keywords: ['contract', 'contrato'], icon: FileText },
      { keywords: ['file', 'arquivo'], icon: FileText },
      { keywords: ['category', 'categoria'], icon: Tag },
      { keywords: ['type', 'tipo'], icon: Type },
      { keywords: ['owner', 'proprietario'], icon: User },
      { keywords: ['tenant', 'inquilino'], icon: Users },
      { keywords: ['property', 'imovel'], icon: Home },
      { keywords: ['bedroom', 'quarto'], icon: Bed },
      { keywords: ['bathroom', 'banheiro'], icon: Bath },
      { keywords: ['garage', 'garagem'], icon: Car },
      { keywords: ['area', 'area'], icon: Ruler },
      { keywords: ['furnished', 'mobiliado'], icon: Sofa },
      { keywords: ['floor', 'andar'], icon: Building },
      { keywords: ['tax', 'imposto'], icon: Landmark },
      { keywords: ['contact', 'contato'], icon: UserCircle },
      { keywords: ['role', 'cargo', 'funcao'], icon: Briefcase },
      { keywords: ['department', 'departamento'], icon: Building },
      { keywords: ['company', 'empresa'], icon: Building2 },
      { keywords: ['trade', 'fantasia'], icon: Building2 },
      { keywords: ['legal', 'razao'], icon: FileText },
      { keywords: ['cnpj', 'cpf'], icon: CreditCard },
      { keywords: ['registration', 'inscricao', 'registro'], icon: FileCheck },
      { keywords: ['license', 'licenca'], icon: FileDigit },
      { keywords: ['whatsapp', 'zap'], icon: MessageCircle },
      { keywords: ['web', 'site', 'url'], icon: Globe },
      { keywords: ['country', 'pais'], icon: Globe },
      { keywords: ['default', 'padrao'], icon: Type },
    ];
    
    for (const mapping of keywordMap) {
      for (const keyword of mapping.keywords) {
        if (fieldLower.includes(keyword)) {
          const Icon = mapping.icon;
          return <Icon size={16} className="text-content-muted" />;
        }
      }
    }
    
    const Icon = FIELD_ICONS['default'] || Type;
    return <Icon size={16} className="text-content-muted" />;
  };

  const getFilteredSuggestions = (field: string) => {
    const filter = visibleFilters.find(f => f.field === field);
    const searchTerm = searchTerms[field]?.toLowerCase() || '';
    
    if (!filter) return [];
    
    const source = filter.options || filter.values || [];
    const isPhone = isPhoneField(field);
    
    if (filter.type === 'select' && source.length > 0 && typeof source[0] === 'object') {
      const objectSource = source as Array<{ value: any; label: string }>;
      if (searchTerm) {
        return objectSource.filter((item: { value: any; label: string }) => 
          item.label.toLowerCase().includes(searchTerm)
        );
      }
      return objectSource;
    }
    
    if (searchTerm) {
      return source.filter((item: any) => 
        String(item).toLowerCase().includes(searchTerm)
      );
    }
    
    return source;
  };

  const renderFilterInput = (filter: DynamicFilter) => {
    const filterValue = localFilters[filter.field] || { 
      value: '', 
      showDropdown: false,
    };
    const searchTerm = searchTerms[filter.field] || '';
    const suggestions = getFilteredSuggestions(filter.field);
    const hasSuggestions = suggestions.length > 0;
    const Icon = getFilterIcon(filter.field);
    const isDropdownOpen = Boolean(filterValue.showDropdown) && activeDropdown === filter.field;
    const isPhone = isPhoneField(filter.field);
    const hasOptions = filter.autocomplete || filter.options || filter.values;
    
    return (
      <div className="relative min-h-[90px]" key={filter.field}>
        <label className="block text-sm font-medium text-content-secondary mb-1">
          <div className="flex items-center gap-2">
            {Icon}
            <span className="truncate">{filter.label}</span>
          </div>
        </label>
        
        {filter.dateRange ? (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <input
                type="date"
                className="w-full border border-ui-border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                value={filterValue.value || ''}
                onChange={(e) => updateFilterValue(filter.field, 'value', e.target.value)}
                min={filter.min}
                max={filter.max}
              />
            </div>
            <div>
              <input
                type="date"
                className="w-full border border-ui-border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                value={filterValue.value2 || ''}
                onChange={(e) => updateFilterValue(filter.field, 'value2', e.target.value)}
                min={filterValue.value || filter.min}
                max={filter.max}
              />
            </div>
          </div>
        ) : (
          <div className="relative">
            <div className="relative">
              <input
                ref={(el) => { 
                  if (el) {
                    inputRefs.current[filter.field] = el;
                  }
                }}
                type={filter.inputType || 'text'}
                className="w-full border border-ui-border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent pr-10"
                // IMPORTANTE: Para campos de telefone com opções, mostra o valor como veio do back-end (já formatado)
                // Para inputs livres de telefone, aplica formatação
                value={isPhone && hasOptions ? searchTerm : (isPhone ? formatPhone(searchTerm) : searchTerm)}
                onChange={(e) => {
                  const value = e.target.value;
                  
                  if (isPhone) {
                    const cleanedValue = removePhoneMask(value);
                    
                    setSearchTerms(prev => ({
                      ...prev,
                      [filter.field]: value
                    }));
                    
                    setLocalFilters(prev => {
                      const current = prev[filter.field] || {};
                      const showDropdown = Boolean(
                        cleanedValue.length > 0 && 
                        hasOptions
                      );
                      
                      return {
                        ...prev,
                        [filter.field]: {
                          ...current,
                          value: cleanedValue,
                          showDropdown: showDropdown
                        }
                      };
                    });
                  } else {
                    setSearchTerms(prev => ({
                      ...prev,
                      [filter.field]: value
                    }));
                    
                    setLocalFilters(prev => {
                      const current = prev[filter.field] || {};
                      const showDropdown = Boolean(
                        value.length > 0 && 
                        hasOptions
                      );
                      
                      return {
                        ...prev,
                        [filter.field]: {
                          ...current,
                          value: value,
                          showDropdown: showDropdown
                        }
                      };
                    });
                  }
                  
                  if (value.length > 0 && hasOptions) {
                    handleInputFocus(filter.field);
                  }
                }}
                onFocus={() => handleInputFocus(filter.field)}
                onBlur={() => handleInputBlur(filter.field)}
                placeholder={isPhone ? "Ex: (11) 99999-9999" : `Digite...`}
              />
              
              {hasOptions && !isPhone && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2"
                  onClick={(e) => {
                    e.preventDefault();
                    if (isDropdownOpen) {
                      setLocalFilters(prev => ({
                        ...prev,
                        [filter.field]: {
                          ...(prev[filter.field] || {}),
                          showDropdown: false
                        }
                      }));
                      setActiveDropdown(null);
                    } else {
                      handleInputFocus(filter.field);
                      inputRefs.current[filter.field]?.focus();
                    }
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <svg 
                    className={`w-4 h-4 text-content-placeholder transition-transform ${isDropdownOpen ? 'transform rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}
            </div>
            
            {isDropdownOpen && hasOptions && (
              <div 
                ref={(el) => { 
                  if (el) {
                    dropdownRefs.current[filter.field] = el;
                  }
                }}
                className="absolute z-50 w-full mt-1 bg-surface border border-ui-border rounded-lg shadow-lg max-h-60 overflow-y-auto"
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
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleOptionClick(filter.field, value);
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleOptionClick(filter.field, value);
                          }}
                        >
                          {/* As opções de telefone já vêm formatadas do back-end, mostramos o label como está */}
                          {label}
                        </div>
                      );
                    }
                    
                    return (
                      <div
                        key={index}
                        className="px-3 py-2 hover:bg-surface-subtle cursor-pointer text-sm"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleOptionClick(filter.field, suggestion);
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleOptionClick(filter.field, suggestion);
                        }}
                      >
                        {/* As opções de telefone já vêm formatadas do back-end, mostramos como estão */}
                        {String(suggestion)}
                      </div>
                    );
                  })
                ) : (
                  <div className="px-3 py-2 text-sm text-content-muted">
                    Nenhuma opção disponível
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {filter.description && (
          <p className="text-xs text-content-muted mt-1 truncate">{filter.description}</p>
        )}
      </div>
    );
  };

  const getActiveFilterCount = () => {
    return Object.values(localFilters).filter(filter => 
      filter && (
        (filter.value !== undefined && filter.value !== null && filter.value !== '') ||
        (filter.values && filter.values.length > 0) ||
        (filter.value2 !== undefined && filter.value2 !== null && filter.value2 !== '')
      )
    ).length;
  };

  if (!visible) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-layer-overlay-soft" onClick={() => setVisible(false)} />
      
      <div 
        ref={modalRef}
        className="absolute top-[40%] sm:top-full left-0 z-50 mt-2 bg-surface rounded-xl shadow-2xl border border-ui-border-soft"
        style={{
          width: 'min(95vw, 1000px)',
          maxHeight: 'min(90vh, 400px)',
          overflow: 'hidden'
        }}
      >
        <div className="p-4 w-full h-full flex flex-col">
          <div className="flex justify-between items-center mb-4 flex-shrink-0">
            <div>
              <h3 className="text-lg font-semibold text-content">Filtrar {title}</h3>
              <p className="text-sm text-content-muted mt-1">
                {getActiveFilterCount() > 0 
                  ? `${getActiveFilterCount()} filtro(s) ativo(s)` 
                  : "Selecione os critérios de filtro"}
              </p>
            </div>
            <button 
              onClick={() => setVisible(false)}
              className="p-2 hover:bg-surface-subtle rounded-lg transition-colors flex-shrink-0"
              aria-label="Fechar filtro"
            >
              <X size={20} className="text-content-secondary" />
            </button>
          </div>
          
          <div 
            ref={contentRef}
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto flex-grow px-1"
            style={{
              maxHeight: 'calc(min(90vh, 350px) - 140px)'
            }}
          >
            {visibleFilters.map((filter) => renderFilterInput(filter))}
          </div>
          
          <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-ui-border-soft flex-shrink-0">
            <button 
              onClick={handleClear}
              className="px-4 py-2 border border-ui-border rounded-lg text-sm font-medium hover:bg-surface-subtle transition-colors"
            >
              Limpar tudo
            </button>
            <button 
              onClick={handleApply}
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