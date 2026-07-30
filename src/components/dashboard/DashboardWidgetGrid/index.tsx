'use client';

import { useCallback, useMemo, type ReactNode } from 'react';
import GridLayout, { WidthProvider, type Layout } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useDashboardLayout, DashboardLayoutItem } from '@/hooks/useDashboardLayout';
import { useIsMobile, MOBILE_BREAKPOINT_PX } from '@/hooks/useIsMobile';

const ResponsiveGridLayout = WidthProvider(GridLayout);

export const ROW_HEIGHT = 40;
export const GRID_GAP = 16;
/** Mesma classe que o ChartCard usa: a barra do título é a alça de arrastar. */
export const DRAG_HANDLE_CLASS = 'widget-drag-handle';

export interface DashboardWidget {
  body: ReactNode;
  /**
   * true  → o grid desenha a moldura do cartão (widgets baseados em ChartCard,
   *         que só renderizam cabeçalho + corpo).
   * false → o widget já tem moldura própria completa (NumericCard, EChartsDonut,
   *         EChartsGauge, EChartsBar); duplicar geraria cartão-dentro-de-cartão.
   */
  framed: boolean;
  /** Card com dropdown/menu que precisa escapar dos limites do cartão. */
  overflowVisible?: boolean;
}

interface DashboardWidgetGridProps {
  /** Chave de persistência do layout por usuário (UserDashboardLayout). */
  resource: string;
  defaultLayout: DashboardLayoutItem[];
  /** Retorna o widget de um id, ou null para omiti-lo do grid. */
  renderWidget: (id: string) => DashboardWidget | null;
  /**
   * Ajuste de itens de layouts JÁ SALVOS por usuários, quando a altura de um
   * widget muda entre releases (o layout salvo venceria o novo default).
   */
  normalizeItem?: (item: DashboardLayoutItem) => DashboardLayoutItem;
}

/**
 * Casca comum aos grids do Dashboard (Financeiro, Imóveis, Clientes): layout de
 * 12 colunas arrastável/redimensionável com persistência por usuário,
 * reconciliação do layout salvo com o conjunto atual de widgets, e lista
 * empilhada no mobile.
 *
 * Cada aba só declara seu `resource`, seu layout default e como renderizar cada
 * widget — a mecânica de grid vive aqui, uma vez.
 */
export default function DashboardWidgetGrid({
  resource,
  defaultLayout,
  renderWidget,
  normalizeItem,
}: DashboardWidgetGridProps) {
  const { layout, isLoading, saveLayout } = useDashboardLayout(resource, defaultLayout);
  const isMobile = useIsMobile(MOBILE_BREAKPOINT_PX);

  const knownIds = useMemo(() => new Set(defaultLayout.map((item) => item.i)), [defaultLayout]);

  // Reconcilia o layout salvo com o conjunto atual de widgets: descarta ids que
  // não existem mais (ex.: placeholders antigos) e acrescenta ao final os que o
  // usuário ainda não tem salvos (ex.: widgets novos de uma release). Sem isso,
  // layouts salvos antes de uma mudança renderizam cards vazios ou simplesmente
  // não mostram os gráficos novos.
  const displayLayout = useMemo(() => {
    const known = layout
      .filter((item) => knownIds.has(item.i))
      .map((item) => (normalizeItem ? normalizeItem(item) : item));
    const present = new Set(known.map((item) => item.i));
    const bottom = known.reduce((max, item) => Math.max(max, item.y + item.h), 0);
    const missing = defaultLayout
      .filter((d) => !present.has(d.i))
      .map((d) => ({ ...d, y: bottom + d.y }));
    return [...known, ...missing];
  }, [layout, knownIds, defaultLayout, normalizeItem]);

  const handleLayoutChange = useCallback(
    (newLayout: Layout) => {
      saveLayout(newLayout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })));
    },
    [saveLayout]
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
      </div>
    );
  }

  // Em telas estreitas o grid de 12 colunas fica ilegível (cada coluna vira uma
  // tira estreita demais para os gráficos). Sem drag/resize (sem sentido em
  // touch), lista empilhada de largura total, preservando a altura relativa de
  // cada widget (h * linha) do layout salvo.
  if (isMobile) {
    return (
      <div className="flex flex-col gap-4 w-full">
        {displayLayout.map((item) => {
          const widget = renderWidget(item.i);
          if (!widget) return null;
          const heightPx = item.h * ROW_HEIGHT + (item.h - 1) * GRID_GAP;
          return (
            <div
              key={item.i}
              style={{ height: heightPx }}
              className={
                widget.framed
                  ? 'w-full bg-surface rounded-xl border border-ui-border-soft shadow-sm overflow-hidden flex flex-col'
                  : 'w-full'
              }
            >
              {widget.body}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <ResponsiveGridLayout
      className="w-full"
      layout={displayLayout}
      cols={12}
      rowHeight={ROW_HEIGHT}
      margin={[GRID_GAP, GRID_GAP]}
      draggableHandle={`.${DRAG_HANDLE_CLASS}`}
      onLayoutChange={handleLayoutChange}
    >
      {displayLayout.map((item) => {
        const widget = renderWidget(item.i);
        if (!widget) return null;
        return (
          <div
            key={item.i}
            className={
              widget.framed
                ? `bg-white dark:bg-surface rounded-xl border border-slate-200/80 dark:border-ui-border-soft shadow-sm flex flex-col transition-all ${
                    widget.overflowVisible ? 'overflow-visible z-20 hover:z-30' : 'overflow-hidden'
                  }`
                : 'h-full'
            }
          >
            {widget.body}
          </div>
        );
      })}
    </ResponsiveGridLayout>
  );
}
