'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Balão de ajuda que escapa do `overflow` do container.
 *
 * A grid de Investimentos rola dentro de um `overflow-auto` e os modais dentro
 * de um `overflow-y-auto`; um balão posicionado com `absolute` é recortado nas
 * bordas desses containers — foi o que cortava a observação da linha. Aqui ele
 * é medido pelo `getBoundingClientRect` do gatilho e desenhado em portal no
 * `body`, com `position: fixed`, então nenhum ancestral consegue cortá-lo.
 *
 * Vira para baixo quando não há espaço acima (linha no topo da tabela).
 */

/** Espaço mínimo acima do gatilho para o balão caber virado para cima. */
const FLIP_THRESHOLD = 140;

interface Props {
  content: ReactNode;
  children: ReactNode;
  /** Largura máxima do balão. */
  width?: number;
}

interface Position {
  top: number;
  left: number;
  below: boolean;
}

export default function HoverTooltip({ content, children, width = 256 }: Props) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<Position | null>(null);

  const show = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const below = rect.top < FLIP_THRESHOLD;
    setPosition({
      top: below ? rect.bottom + 8 : rect.top - 8,
      left: rect.left + rect.width / 2,
      below,
    });
  }, []);

  const hide = useCallback(() => setPosition(null), []);

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-flex"
      >
        {children}
      </span>

      {position &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              maxWidth: width,
              transform: `translate(-50%, ${position.below ? '0' : '-100%'})`,
            }}
            className="pointer-events-none z-[10000] whitespace-pre-wrap break-words rounded-lg bg-content px-3 py-2 text-[11px] font-normal leading-snug text-content-inverse shadow-xl"
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}
