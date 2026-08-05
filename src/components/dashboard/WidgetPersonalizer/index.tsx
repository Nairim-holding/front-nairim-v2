'use client';

import { useState } from 'react';
import { Settings2 } from 'lucide-react';
import ColumnCustomizer from '@/components/table/ColumnCustomizer';
import type { ColumnDef } from '@/types/types';

export interface WidgetOption {
  id: string;
  label: string;
}

interface WidgetPersonalizerProps {
  widgets: WidgetOption[];
  visibleWidgetIds: string[];
  onChange: (ids: string[]) => void;
}

/**
 * "Personalizar Gráficos" (Tarefa 10, 29/07/26) — escolher quais gráficos
 * aparecem no Resumo de cada Ambiente. Mesma experiência/componente de
 * "Personalizar Colunas" da tela de Lançamentos (ColumnCustomizer), sem os
 * controles de reordenar: a posição de cada gráfico já se ajusta arrastando o
 * próprio card no grid, não faz sentido reordenar duas vezes.
 */
export default function WidgetPersonalizer({ widgets, visibleWidgetIds, onChange }: WidgetPersonalizerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const columns: ColumnDef[] = widgets.map((w) => ({ field: w.id, label: w.label }));

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="p-2 rounded-lg border border-ui-border-soft bg-surface text-content-muted hover:text-content hover:bg-surface-subtle transition-colors shrink-0"
        title="Personalizar gráficos exibidos"
      >
        <Settings2 size={18} />
      </button>
      <ColumnCustomizer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        columns={columns}
        onReorder={() => {}}
        onReset={() => onChange(widgets.map((w) => w.id))}
        visibleColumns={visibleWidgetIds}
        onVisibilityChange={onChange}
        title="Personalizar Gráficos"
        allowReorder={false}
      />
    </>
  );
}
