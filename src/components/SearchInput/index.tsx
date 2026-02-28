/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useRef, ChangeEvent, useEffect, memo } from "react";
import { Search } from "lucide-react";

interface SearchInputProps {
  initialValue: string;
  onSearch: (value: string) => void;
  placeholder?: string;
  delay?: number;
  autoFocus?: boolean; // Nova prop
}

function SearchInputComponent({ 
  initialValue,
  onSearch, 
  placeholder = "Pesquisar...",
  delay = 300,
  autoFocus = false,
}: SearchInputProps) {
  const [inputValue, setInputValue] = useState(initialValue);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Sincroniza apenas uma vez com o valor inicial
  useEffect(() => {
    if (isMounted.current) {
      setInputValue(initialValue);
    }
  }, [initialValue]);

  // Foca no input quando o componente monta
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      // Usar setTimeout para garantir que o foco aconteça após o DOM estar pronto
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  // Cleanup
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    // Limpa o timeout anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Se estiver vazio, busca imediatamente
    if (newValue.trim() === '') {
      onSearch('');
      return;
    }
    
    // Configura novo timeout para busca com debounce
    timeoutRef.current = setTimeout(() => {
      onSearch(newValue.trim());
    }, delay);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // Cancela o timeout e faz busca imediata
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      onSearch(inputValue.trim());
    }
  };

  const handleClear = () => {
    setInputValue('');
    onSearch('');
    // Focar no input após limpar
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className="flex border py-2 px-3 rounded-lg border-ui-border w-full gap-3">
      <input
        ref={inputRef}
        className="border-none outline-none w-full text-[14px] font-normal text-content-secondary bg-transparent"
        type="search"
        placeholder={placeholder}
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      {inputValue ? (
        <button 
          onClick={handleClear}
          className="text-content-placeholder hover:text-content-secondary text-sm"
          type="button"
          aria-label="Limpar busca"
        >
          ✕
        </button>
      ) : (
        <Search size={20} color="var(--color-text-muted)" />
      )}
    </div>
  );
}

export default memo(SearchInputComponent);
