'use client';

// Teto de 100 é imposto pelos validadores Zod das Server Actions
// (`.max(100)`) em todas as telas que usam este seletor — 150 sempre falhava.
const PAGE_SIZE_OPTIONS = [30, 50, 100] as const;

interface SelectLimitProps {
  limit: number;
  onLimitChange: (limit: number) => void;
}

export default function SelectLimit({ limit, onLimitChange }: SelectLimitProps) {
  return (
    <div className="flex justify-between items-center relative flex-wrap">
      <div className="flex items-center gap-2">
        <p className="text-[14px] font-normal text-content-secondary">Exibir</p>
        <select
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
          className="border text-[14px] font-normal text-content-secondary px-3 py-2 border-ui-border outline-none rounded-lg bg-surface focus:border-brand focus:ring-1 focus:ring-brand"
        >
          {PAGE_SIZE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <p className="text-[14px] font-normal text-content-secondary">registros</p>
      </div>
    </div>
  );
}
