'use client';

import { useId } from 'react';
import { isSafeBrandingColor } from '@/shared/validators/branding-color';

interface ColorInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  defaultValue?: string;
}

export default function ColorInput({ label, value, onChange, defaultValue = '#8b5cf6' }: ColorInputProps) {
  const id = useId();
  const invalid = Boolean(value) && !isSafeBrandingColor(value);
  const effective = isSafeBrandingColor(value) ? value : defaultValue;
  const hex = effective.slice(1);
  const swatch = hex.length < 5 ? `#${hex.slice(0, 3).split('').map(char => char + char).join('')}` : effective.slice(0, 7);
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {label && <label htmlFor={id} className="text-sm text-content-secondary">{label}</label>}
      <div className="flex items-center gap-3">
        <input
          type="color"
          aria-label={`Selecionar ${label?.toLowerCase() || 'cor'}`}
          value={swatch}
          onChange={e => onChange(e.target.value)}
          className="w-10 h-10 rounded-lg cursor-pointer border border-ui-border shrink-0"
        />
        <input
          id={id}
          type="text"
          aria-label={label || 'Código da cor'}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-error` : undefined}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={defaultValue}
          maxLength={9}
          spellCheck={false}
          className="min-w-0 w-full flex-1 h-10 text-content bg-surface border border-ui-border rounded-lg px-3 font-mono text-sm focus:outline-none focus:border-brand"
        />
      </div>
      {invalid && <p id={`${id}-error`} className="text-xs text-state-error">Use uma cor hexadecimal, como #8b5cf6.</p>}
    </div>
  );
}
