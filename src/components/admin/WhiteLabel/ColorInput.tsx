'use client';

interface ColorInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  defaultValue?: string;
}

export default function ColorInput({ label, value, onChange, defaultValue = '#8b5cf6' }: ColorInputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <span className="text-sm text-content-secondary">{label}</span>}
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value || defaultValue}
          onChange={e => onChange(e.target.value)}
          className="w-10 h-10 rounded-lg cursor-pointer border border-ui-border shrink-0"
        />
        <input
          type="text"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={defaultValue}
          maxLength={9}
          className="flex-1 h-[46px] text-content bg-surface border border-ui-border rounded-lg px-3 text-sm focus:outline-none focus:border-brand"
        />
      </div>
    </div>
  );
}
