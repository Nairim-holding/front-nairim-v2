import React from 'react';
import { Check, Minus } from 'lucide-react';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Estado parcial (alguns marcados) — visual de traço, comum em "marcar todos". */
  indeterminate?: boolean;
  label?: string;
  disabled?: boolean;
  /** Rótulo acessível quando não há `label` visível (ex.: célula de matriz). */
  ariaLabel?: string;
  className?: string;
}

/**
 * Checkbox do design system. Segue as mesmas convenções visuais do Toggle
 * (cor de marca via --color-brand-primary, mesmo anel de foco), mas é compacto —
 * o que viabiliza matrizes densas, onde um Toggle de 44px não caberia.
 */
export default function Checkbox({
  checked,
  onChange,
  indeterminate = false,
  label,
  disabled = false,
  ariaLabel,
  className = '',
}: CheckboxProps) {
  const active = checked || indeterminate;

  const box = (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={ariaLabel ?? label}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-brand/50 focus:ring-offset-1 ${
        active
          ? 'bg-[var(--color-brand-primary)] border-[var(--color-brand-primary)] text-white'
          : 'bg-transparent border-ui-border-strong hover:border-gray-400'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
    >
      {indeterminate ? (
        <Minus size={14} strokeWidth={3} />
      ) : checked ? (
        <Check size={14} strokeWidth={3} />
      ) : null}
    </button>
  );

  if (!label) return box;

  return (
    <div className="flex items-center gap-3">
      {box}
      <span className="text-[14px] font-medium text-content-secondary">{label}</span>
    </div>
  );
}
