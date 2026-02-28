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
          {[30, 50, 100, 150].map((option) => (
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
