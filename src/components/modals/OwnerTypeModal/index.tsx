'use client';

import { User, Building2 } from 'lucide-react';
import type { OwnerType } from '@/types/owner';
import { useRef, useEffect } from 'react';

interface ModalSelectTypeOwnerProps {
  onSelect: (tipo: OwnerType) => void;
  onClose: () => void;
  className?: string;
}

export default function ModalSelectTypeOwner({ 
  onSelect, 
  onClose,
  className = ""
}: ModalSelectTypeOwnerProps) {

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    // Transformamos em absolute para ele flutuar a partir do botão pai
    <div className={`absolute z-50 mt-2 ${className}`}>
      <div 
        ref={dropdownRef}
        className="w-72 bg-surface rounded-lg shadow-xl border border-ui-border animate-in slide-in-from-top-2 duration-200"
      >
        <div className="p-4">
          <h3 className="text-sm font-semibold text-content mb-3">
            Selecione o tipo de contato
          </h3>

          <div className="space-y-2">
            <button
              onClick={() => onSelect('fisica')}
              className="flex w-full p-3 rounded-lg hover:bg-surface-subtle transition-colors text-content-secondary hover:text-content"
            >
              <User className="mr-3 text-brand" />
              Pessoa Física
            </button>

            <button
              onClick={() => onSelect('juridica')}
              className="flex w-full p-3 rounded-lg hover:bg-surface-subtle transition-colors text-content-secondary hover:text-content"
            >
              <Building2 className="mr-3 text-brand" />
              Pessoa Jurídica
            </button>
          </div>

          <button
            onClick={onClose}
            className="mt-3 w-full text-sm text-content-muted hover:text-content-secondary transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}