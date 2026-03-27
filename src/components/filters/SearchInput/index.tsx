'use client';

import { useState, useRef, useCallback, useEffect, memo } from 'react';
import type { ChangeEvent } from 'react';
import { Search } from 'lucide-react';

interface SearchInputProps {
  initialValue: string;
  onSearch: (value: string) => void;
  placeholder?: string;
  delay?: number;
  autoFocus?: boolean;
}

function SearchInputComponent({
  initialValue,
  onSearch,
  placeholder = 'Pesquisar...',
  delay = 300,
  autoFocus = false,
}: SearchInputProps) {
  const [inputValue, setInputValue] = useState(initialValue);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync with external value changes
  useEffect(() => {
    setInputValue(initialValue);
  }, [initialValue]);

  // Auto focus on mount when requested
  useEffect(() => {
    if (!autoFocus) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, [autoFocus]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

      if (newValue.trim() === '') {
        onSearch('');
        return;
      }

      debounceTimerRef.current = setTimeout(() => onSearch(newValue.trim()), delay);
    },
    [onSearch, delay],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter') return;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      onSearch(inputValue.trim());
    },
    [onSearch, inputValue],
  );

  const handleClear = useCallback(() => {
    setInputValue('');
    onSearch('');
    inputRef.current?.focus();
  }, [onSearch]);

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
