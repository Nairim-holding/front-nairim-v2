'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type PropertyTransactionType = 'comprar' | 'alugar';
export type PropertySearchType = 'apartment' | 'house' | 'all';

export interface PropertyFiltersState {
  transactionType: PropertyTransactionType;
  location: string;
  dataInicio: string;
  dataFim: string;
  quartos: number | '';
  andares: number | '';
  vagas: number | '';
  banheiros: number | '';
  cep: string;
  areaMin: string;
  areaMax: string;
  endereco: string;
  bairro: string;
  uf: string;
  garagem: number | '';
  lavabo: number | '';
  fachada: string;
  mobilia: number | '';
  valorMin: string;
  valorMax: string;
  propertyType: PropertySearchType;
}

interface FilterContextType {
  filters: PropertyFiltersState;
  setFilters: (filters: PropertyFiltersState) => void;
  activeFiltersCount: number;
  resetFilters: () => void;
  isFilterOpen: boolean;
  setIsFilterOpen: (open: boolean) => void;
}

// ─── Default state ───────────────────────────────────────────────────────────

const DEFAULT_FILTERS: PropertyFiltersState = {
  transactionType: 'alugar',
  location: '',
  dataInicio: '',
  dataFim: '',
  quartos: '',
  andares: '',
  vagas: '',
  banheiros: '',
  cep: '',
  areaMin: '',
  areaMax: '',
  endereco: '',
  bairro: '',
  uf: '',
  garagem: '',
  lavabo: '',
  fachada: '',
  mobilia: '',
  valorMin: '',
  valorMax: '',
  propertyType: 'all',
};

// ─── Context ─────────────────────────────────────────────────────────────────

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export const useFilters = (): FilterContextType => {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
};

// ─── Provider ────────────────────────────────────────────────────────────────

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<PropertyFiltersState>(DEFAULT_FILTERS);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const activeFiltersCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'transactionType' || key === 'propertyType' || key === 'location') return false;
    return value !== '' && value !== 0 && value !== 'alugar' && value !== 'comprar' && value !== 'all';
  }).length;

  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  return (
    <FilterContext.Provider
      value={{ filters, setFilters, activeFiltersCount, resetFilters, isFilterOpen, setIsFilterOpen }}
    >
      {children}
    </FilterContext.Provider>
  );
}
