/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import { X, Check } from "lucide-react";
import { FilterField } from "@/types/administrador";

interface FilterModalProps {
  visible: boolean;
  setVisible: (visible: boolean) => void;
  onApply: (filters: Record<string, string | number | null>) => void;
  onClear: () => void;
  title: string;
  fields: FilterField[];
}

export default function FilterModal({ 
  visible, 
  setVisible, 
  onApply, 
  onClear, 
  title, 
  fields 
}: FilterModalProps) {
  const [localFilters, setLocalFilters] = useState<Record<string, string | number | null>>({});

  useEffect(() => {
    if (visible) {
      setLocalFilters({});
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="bg-surface p-6 rounded-xl shadow-2xl border border-ui-border-soft">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-content">Filtrar {title}</h3>
          <p className="text-sm text-content-muted mt-1">Selecione os critérios de filtro</p>
        </div>
        <button 
          onClick={() => setVisible(false)}
          className="p-2 hover:bg-surface-subtle rounded-lg transition-colors"
          aria-label="Fechar filtro"
        >
          <X size={20} className="text-content-secondary" />
        </button>
      </div>
      <div className="space-y-4">
        {fields.map((field) => (
          <div key={field.key}>
            <label className="block text-sm font-medium text-content-secondary mb-2">
              {field.label}
            </label>
            {field.type === 'select' ? (
              <select
                className="w-full border border-ui-border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent bg-surface"
                value={localFilters[field.key] || ''}
                onChange={(e) => setLocalFilters({
                  ...localFilters, 
                  [field.key]: e.target.value || null
                })}
              >
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : (
              <input
                type={field.type}
                className="w-full border border-ui-border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                value={localFilters[field.key] || ''}
                onChange={(e) => setLocalFilters({
                  ...localFilters, 
                  [field.key]: e.target.value || null
                })}
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-ui-border-soft">
        <button 
          onClick={() => {
            onClear();
            setLocalFilters({});
          }}
          className="px-5 py-2.5 border border-ui-border rounded-lg text-sm font-medium hover:bg-surface-subtle transition-colors"
        >
          Limpar tudo
        </button>
        <button 
          onClick={() => onApply(localFilters)}
          className="px-5 py-2.5 bg-gradient-to-r from-brand to-brand-hover text-content-inverse rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <Check size={16} />
          Aplicar filtros
        </button>
      </div>
    </div>
  );
}