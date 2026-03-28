import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export default function Toggle({ checked, onChange, label, disabled = false }: ToggleProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        // Trocamos o bg-green-500 pelo bg-brand (sua variável --color-brand-primary)
        className={`flex-shrink-0 w-11 h-6 rounded-full relative transition-colors focus:outline-none focus:ring-2 focus:ring-brand/50 focus:ring-offset-1 ${
          checked 
            ? 'bg-[var(--color-brand-primary)]' // Usando a variável explicitamente como você pediu
            : 'bg-ui-border-strong hover:bg-gray-400'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span 
          className={`absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${
            checked ? 'translate-x-5' : ''
          }`} 
        />
      </button>
      {label && (
        <span className="text-[14px] font-medium text-content-secondary">
          {label}
        </span>
      )}
    </div>
  );
}