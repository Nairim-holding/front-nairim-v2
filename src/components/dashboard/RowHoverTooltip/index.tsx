'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface HoverTooltipRow {
  label: string;
  value: string;
}

interface RowHoverTooltipProps {
  title: string;
  rows: HoverTooltipRow[];
  /** Classes do próprio elemento da linha (o wrapper É a linha, não um filho extra). */
  className?: string;
  children: ReactNode;
}

/**
 * Legenda (tooltip) ao passar o mouse sobre uma linha de gráfico "hand-rolled"
 * (barras de progresso em JSX puro, sem ECharts) — mesmo DNA visual do tooltip
 * padrão do ECharts usado no resto do Resumo (ver utils/echartsTooltip.ts).
 *
 * Renderiza via portal em `document.body`, posicionado com as coordenadas do
 * gatilho (`getBoundingClientRect`) em vez de `position: absolute` dentro da
 * própria linha — a linha vive num container com `overflow-y-auto` (a lista
 * de cartões/subcategorias), que cortava a legenda (só um canto aparecia).
 */
export default function RowHoverTooltip({ title, rows, className, children }: RowHoverTooltipProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const show = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords({ top: rect.top, left: rect.left + rect.width / 2 });
  }, []);

  const hide = useCallback(() => setCoords(null), []);

  return (
    <>
      <div
        ref={triggerRef}
        className={className}
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        {children}
      </div>
      {coords && typeof document !== 'undefined' && createPortal(
        <div
          className="pointer-events-none fixed z-[999] w-60 -translate-x-1/2 -translate-y-full"
          style={{ top: coords.top - 10, left: coords.left }}
        >
          <div className="overflow-hidden rounded-lg border border-ui-border-soft bg-surface shadow-lg">
            <div className="border-b border-ui-border-soft bg-surface-subtle px-3 py-1.5 text-center text-xs font-bold text-content truncate">
              {title}
            </div>
            <div className="space-y-1 px-3 py-2">
              {rows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium text-content-muted">{row.label}</span>
                  <span className="font-bold text-content">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute left-1/2 top-full -mt-1 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-ui-border-soft bg-surface" />
        </div>,
        document.body
      )}
    </>
  );
}
