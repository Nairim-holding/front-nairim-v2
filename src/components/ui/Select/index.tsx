/* eslint-disable react-hooks/set-state-in-effect */
'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import Label from '../Label';
import { ChevronDown, Search } from 'lucide-react';

export interface Option {
  label: string;
  value: string | number;
}

export interface SelectProps {
  options: Option[];
  defaultValue?: string | number;
  value?: string | number;
  onChange?: (value: string | number) => void;
  label?: string;
  required?: boolean;
  svg?: React.ReactNode;
  id?: string;
  tabIndex?: number;
  disabled?: boolean;
  placeholder?: string;
  searchable?: boolean;
}

// Função auxiliar para remover acentos e caracteres especiais (ex: ç -> c, á -> a)
const normalizeText = (text: string) => {
  if (!text) return '';
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
};

export default function Select({ 
  options, 
  defaultValue, 
  onChange, 
  label, 
  required, 
  svg, 
  id, 
  tabIndex = 0, 
  disabled, 
  value,
  placeholder = "Selecione...",
  searchable = false,
  ...props 
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState<string | number>(value || defaultValue || '');
  const [selectedLabel, setSelectedLabel] = useState<string>(placeholder);
  const [searchTerm, setSearchTerm] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const optionsListRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const isMouseDownRef = useRef(false);

  useEffect(() => {
    const targetValue = value !== undefined ? value : defaultValue;
    if (targetValue !== undefined && targetValue !== '') {
      const found = options.find(opt => String(opt.value) === String(targetValue));
      if (found) {
        setSelectedLabel(found.label);
        setSelectedValue(targetValue);
      }
    } else {
      setSelectedLabel(placeholder);
      setSelectedValue('');
    }
  }, [value, defaultValue, options, placeholder]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => { 
      if (
        containerRef.current && 
        !containerRef.current.contains(event.target as Node) &&
        optionsListRef.current &&
        !optionsListRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  // Aplica o filtro ignorando acentos e case sensitive
  const filteredOptions = useMemo(() => {
    if (!searchable || !searchTerm) return options;
    const normalizedSearch = normalizeText(searchTerm);
    return options.filter(opt => normalizeText(opt.label).includes(normalizedSearch));
  }, [options, searchable, searchTerm]);

  const handleOptionSelect = (option: Option) => {
    setSelectedValue(option.value);
    setSelectedLabel(option.label);
    setIsOpen(false);
    setSearchTerm('');
    
    if (onChange) onChange(option.value);
    
    if (containerRef.current) containerRef.current.focus();
  };

  const toggleOpen = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      if (isOpen) setSearchTerm('');
    }
  };

  const handleFocus = () => {
    if (!disabled && !isOpen && !isMouseDownRef.current) {
      setIsOpen(true);
    }
    isMouseDownRef.current = false;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    isMouseDownRef.current = true;
  };

  const handleContainerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;

    if (e.key === 'Tab' && isOpen) {
      e.preventDefault(); 
      if (filteredOptions.length > 0) {
        if (searchable && searchInputRef.current) {
          searchInputRef.current.focus();
        } else {
          optionRefs.current[0]?.focus();
        }
      }
    }
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleOpen();
    } 
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
      setTimeout(() => {
        if (searchable && searchInputRef.current) searchInputRef.current.focus();
        else optionRefs.current[0]?.focus();
      }, 0);
    }
  };

  const handleOptionKeyDown = (e: React.KeyboardEvent<HTMLLIElement>, index: number, option: Option) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleOptionSelect(option);
    } 
    else if (e.key === 'Tab') {
      if (index < filteredOptions.length - 1) {
        e.preventDefault();
        optionRefs.current[index + 1]?.focus();
      } 
      else {
        setIsOpen(false);
      }
    }
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = index + 1;
      if (nextIndex < filteredOptions.length) {
        optionRefs.current[nextIndex]?.focus();
      }
    } 
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = index - 1;
      if (prevIndex >= 0) {
        optionRefs.current[prevIndex]?.focus();
      } else {
        if (searchable && searchInputRef.current) searchInputRef.current.focus();
        else containerRef.current?.focus();
      }
    }
    else if (e.key === 'Escape') {
      setIsOpen(false);
      containerRef.current?.focus();
    }
  };

  return (
    <div className="relative font-poppins w-full min-w-[300px] flex-1">
      <Label id={id} label={label} required={required} svg={svg} />
      
      <div
        ref={containerRef}
        className={`
          ${disabled ? 'bg-surface-muted cursor-not-allowed outline-none' : 'bg-surface border-ui-border cursor-pointer outline-none focus:ring-2 focus:ring-brand focus:border-transparent'} 
          border rounded-lg py-2 px-4 flex justify-between items-center relative text-[14px] text-content-secondary h-[40px] w-full
        `}
        onClick={toggleOpen}
        onMouseDown={handleMouseDown}
        tabIndex={disabled ? undefined : tabIndex}
        onKeyDown={handleContainerKeyDown}
        onFocus={handleFocus} 
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown size={20} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && !disabled && (
        <div 
          ref={optionsListRef as React.RefObject<HTMLDivElement>}
          className="absolute z-50 w-full bg-surface border border-ui-border rounded-lg mt-1 shadow-lg max-h-60 flex flex-col"
        >
          {searchable && (
            <div className="p-2 border-b border-ui-border-soft sticky top-0 bg-surface z-10 flex items-center gap-2">
              <Search size={16} className="text-content-placeholder shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                className="w-full text-sm outline-none bg-transparent placeholder-gray-400"
                placeholder="Pesquisar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    optionRefs.current[0]?.focus();
                  } else if (e.key === 'Escape') {
                    setIsOpen(false);
                    containerRef.current?.focus();
                  }
                }}
              />
            </div>
          )}
          
          <ul className="overflow-y-auto flex-1 py-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => (
                <li
                  key={`${option.value}-${index}`}
                  ref={(el) => { optionRefs.current[index] = el; }}
                  className={`
                    py-2 px-4 cursor-pointer outline-none text-[14px]
                    ${String(selectedValue) === String(option.value) ? 'bg-surface-subtle text-brand-hover font-semibold' : ''}
                    hover:bg-surface-subtle focus:bg-surface-subtle focus:text-brand-hover
                  `}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOptionSelect(option);
                  }}
                  tabIndex={0} 
                  onKeyDown={(e) => handleOptionKeyDown(e, index, option)}
                >
                  {option.label}
                </li>
              ))
            ) : (
              <li className="py-2 px-4 text-[14px] text-content-muted text-center italic">
                Nenhuma opção encontrada
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}