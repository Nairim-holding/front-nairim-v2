/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";
import Label from "../Label";

export interface InputProps {
  id?: string;
  label?: string;
  required?: boolean;
  type?: string;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  svg?: React.ReactNode;
  disabled?: boolean;
  tabIndex?: number;
  mask?: 'cpf' | 'cnpj' | 'rg' | 'cep' | 'telefone' | 'money' | 'metros2' | 'metros' | 'date';
  autoFocus?: boolean;
  password?: boolean;
  maxLength?: number;
  showIncrementButtons?: boolean;
  min?: number;
  max?: number;
  full?: boolean;
}

const maskCPF = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
  if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
  return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
};

const maskCNPJ = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 5) return `${numbers.slice(0, 2)}.${numbers.slice(2)}`;
  if (numbers.length <= 8) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5)}`;
  if (numbers.length <= 12) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8)}`;
  return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8, 12)}-${numbers.slice(12, 14)}`;
};

const maskRG = (value: string): string => {
  const numbers = value.replace(/\D/g, '').slice(0, 9);
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 5) return `${numbers.slice(0, 2)}.${numbers.slice(2)}`;
  if (numbers.length <= 8) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5)}`;
  return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}-${numbers.slice(8, 9)}`;
};

const maskCEP = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 5) return numbers;
  return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`;
};

const maskPhone = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  if (numbers.length <= 10) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6, 10)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
};

const maskMoney = (value: string): string => {
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

const maskMetros2 = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length === 0) return '';
  
  const amount = parseInt(numbers) / 100;
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const maskMetros = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length === 0) return '';
  
  const amount = parseInt(numbers) / 100;
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const maskDate = (value: string): string => {
  const numbers = value.replace(/\D/g, '').slice(0, 8); // Garante no máximo 8 números
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 4) return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
  return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
};

const applyMask = (maskType: InputProps['mask'], value: string): string => {
  switch (maskType) {
    case "cpf": return maskCPF(value);
    case "cnpj": return maskCNPJ(value);
    case "rg": return maskRG(value);
    case "cep": return maskCEP(value);
    case "telefone": return maskPhone(value);
    case "money": return maskMoney(value);
    case "metros2": return maskMetros2(value);
    case "metros": return maskMetros(value);
    case "date": return maskDate(value);
    default: return value;
  }
};

const removeMask = (maskType: InputProps['mask'], value: string): string => {
  if (!maskType) return value;
  
  switch (maskType) {
    case "cpf":
    case "cnpj":
    case "rg":
    case "cep":
    case "telefone":
      return value.replace(/\D/g, '');
    case "money":
    case "metros2":
    case "metros":
      return value;
    case "date": {
      const numbersDate = value.replace(/\D/g, '');
      if (numbersDate.length === 8) {
        return `${numbersDate.slice(4, 8)}-${numbersDate.slice(2, 4)}-${numbersDate.slice(0, 2)}`;
      }
      return numbersDate; // Se incompleto, retorna os números digitados para falhar na validação
    }
    default:
      return value;
  }
};

export default function Input({
  id,
  label,
  required,
  type,
  value,
  onChange,
  placeholder,
  svg,
  disabled,
  tabIndex,
  mask,
  autoFocus,
  password,
  maxLength,
  showIncrementButtons = false,
  min = 0,
  max,
  full
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const effectiveType = type === 'date' ? 'text' : (password ? (showPassword ? 'text' : 'password') : type);
  const effectiveMask = mask || (type === 'date' ? 'date' : undefined);
  const [displayValue, setDisplayValue] = useState<string>('');
  const [isPasting, setIsPasting] = useState(false);

  useEffect(() => {
    if (value === undefined || value === null) {
      setDisplayValue('');
      return;
    }
    
    let stringValue = String(value);

    // Ajusta o preenchimento inicial se a data vier no formato ISO do DB (YYYY-MM-DD)
    if (effectiveMask === 'date' && stringValue.includes('-')) {
      const parts = stringValue.split('T')[0].split('-');
      if (parts.length === 3) {
        stringValue = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
    
    if (effectiveMask) {
      const maskedValue = applyMask(effectiveMask, stringValue);
      setDisplayValue(maskedValue);
    } else {
      setDisplayValue(stringValue);
    }
  }, [value, effectiveMask]);

  const handleIncrement = () => {
    if (disabled || type !== 'number') return;
    const current = parseFloat(value as string || "0") || 0;
    let newValue = current + 1;
    if (max !== undefined && newValue > max) {
      newValue = max;
    }
    onChange?.({ target: { value: String(newValue) } } as React.ChangeEvent<HTMLInputElement>);
  };

  const handleDecrement = () => {
    if (disabled || type !== 'number') return;
    const current = parseFloat(value as string || "0") || 0;
    let newValue = current - 1;
    if (newValue < min) {
      newValue = min;
    }
    onChange?.({ target: { value: String(newValue) } } as React.ChangeEvent<HTMLInputElement>);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    
    const rawValue = e.target.value;
    
    if (effectiveMask === 'cep') {
      const numbersOnly = rawValue.replace(/\D/g, '');
      const limitedNumbers = numbersOnly.slice(0, 8);
      const maskedValue = maskCEP(limitedNumbers);
      setDisplayValue(maskedValue);
      onChange?.({ target: { value: limitedNumbers } } as React.ChangeEvent<HTMLInputElement>);
    } else if (effectiveMask) {
      const maskedValue = applyMask(effectiveMask, rawValue);
      setDisplayValue(maskedValue);
      const unmaskedValue = removeMask(effectiveMask, maskedValue);
      onChange?.({ target: { value: unmaskedValue } } as React.ChangeEvent<HTMLInputElement>);
    } else {
      setDisplayValue(rawValue);
      onChange?.(e);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    
    if (effectiveMask === 'cep') {
      e.preventDefault();
      setIsPasting(true);
      
      const pastedText = e.clipboardData.getData('text');
      const numbersOnly = pastedText.replace(/\D/g, '');
      
      if (numbersOnly) {
        const limitedNumbers = numbersOnly.slice(0, 8);
        const maskedValue = maskCEP(limitedNumbers);
        setDisplayValue(maskedValue);
        
        onChange?.({ target: { value: limitedNumbers } } as React.ChangeEvent<HTMLInputElement>);
        setTimeout(() => setIsPasting(false), 100);
      }
    }
  };

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <div className="flex flex-col font-poppins w-full min-w-[300px] max-w-[300px] flex-1">
      <Label id={id} label={label} required={required} svg={svg} />

      <div className="relative flex items-center">
        <input
          id={id}
          onKeyDown={(e) => {
            if (type === "number" && e.key === "-") {
              e.preventDefault();
            }
          }}
          onPaste={handlePaste}
          ref={inputRef}
          name={id}
          type={effectiveType}
          value={displayValue}
          onChange={handleInputChange}
          placeholder={placeholder || (effectiveMask === 'date' ? 'DD/MM/AAAA' : undefined)}
          required={required}
          min={min}
          max={max}
          maxLength={effectiveMask === 'date' ? 10 : maxLength} // <-- Trava o input exatamente no limite dos 10 chars "DD/MM/YYYY"
          disabled={disabled}
          tabIndex={tabIndex}
          className={`
            w-full
            border
            rounded-lg
            h-[40px]
            outline-none
            px-5
            text-[14px]
            font-normal
            no-spinner
            border-ui-border
            text-content-secondary
            placeholder:text-content-placeholder
            ${disabled && 'bg-surface-muted cursor-not-allowed'}
            ${password && 'pr-10'}
            ${showIncrementButtons && type === 'number' && 'pr-12'}
          `}
        />
        
        {password && (
          <button
            type="button"
            className="absolute right-3 top-1/2 transform -translate-y-1/2 outline-none text-content-muted hover:text-content-secondary"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
          >
            {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
          </button>
        )}
        
        {showIncrementButtons && type === 'number' && !disabled && (
          <div className="absolute right-2 flex flex-col items-center py-2">
            <button
              type="button"
              onClick={handleIncrement}
              className="text-lg font-bold text-content-muted hover:text-content transition duration-150 ease-in-out"
              tabIndex={-1}
            >
              <ChevronUp  size={18} color="var(--color-text-muted)" />
            </button>
            <button
              type="button"
              onClick={handleDecrement}
              className="text-lg font-bold text-content-muted hover:text-content transition duration-150 ease-in-out"
              tabIndex={-1}
            >
              <ChevronDown  size={18} color="var(--color-text-muted)" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}