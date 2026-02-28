'use client';

import { User, Building2 } from 'lucide-react';
import { OwnerType } from '@/types/owner';
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
    <div className="fixed z-50 left-[5px]">
      <div 
        ref={dropdownRef}
        className={`
          w-72 bg-surface rounded-lg shadow-xl 
          border border-gray-200 
          animate-in slide-in-from-top-2 duration-200
          ${className}
        `}
      >
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Selecione o tipo de proprietário
          </h3>

          <div className="space-y-2">
            <button
              onClick={() => onSelect('fisica')}
              className="flex w-full p-3 rounded-lg hover:bg-gray-50"
            >
              <User className="mr-3 text-purple-600" />
              Pessoa Física
            </button>

            <button
              onClick={() => onSelect('juridica')}
              className="flex w-full p-3 rounded-lg hover:bg-gray-50"
            >
              <Building2 className="mr-3 text-purple-600" />
              Pessoa Jurídica
            </button>
          </div>

          <button
            onClick={onClose}
            className="mt-3 w-full text-sm text-gray-500 hover:text-gray-700"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
