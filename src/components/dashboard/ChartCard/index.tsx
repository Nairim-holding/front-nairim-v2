'use client';

import { createContext, useCallback, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, FileText, X } from 'lucide-react';
import DataModal from '@/components/charts/DataModal';

export interface ChartCardColumn {
  key: string;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  format?: (value: any) => string | ReactNode;
  width?: string;
  tooltip?: string;
  /** Soma esta coluna na linha de totais do rodapé do modal de detalhes. */
  summable?: boolean;
}

export interface ChartCardGroupBy {
  key: string;
  order?: string[];
  unitLabel?: (count: number) => string;
}

export interface ChartPoint { dataIndex: number; name?: string; seriesName?: string; seriesType?: string }
export const ChartDrilldownContext = createContext<((point: ChartPoint) => void) | undefined>(undefined);

export interface ChartCardRenderOpts {
  isFullscreen: boolean;
  openDetails: (point: ChartPoint) => void;
}

interface ChartCardProps {
  title: string;
  subtitle?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  detailData?: any[];
  detailColumns?: ChartCardColumn[];
  detailForPoint?: (point: ChartPoint) => unknown[];
  loadDetailForPoint?: (point: ChartPoint) => Promise<unknown[]>;
  pointDetailColumns?: ChartCardColumn[];
  /** Agrupa o "Ver Dados Detalhados" por um campo dos dados, com subtotal por grupo. */
  detailGroupBy?: ChartCardGroupBy;
  /** Unidade mostrada no rodapé do modal de detalhes ("Total: N <detailTotalLabel>"). */
  detailTotalLabel?: string;
  dragHandleClassName?: string;
  /** Fora do grid arrastável (ex.: aba Portfólio) não há o que arrastar — sem alça nem cursor-move. */
  isDraggable?: boolean;
  children: (opts: ChartCardRenderOpts) => ReactNode;
}

/**
 * Chrome comum a todos os cards de gráfico do Dashboard Financeiro: título,
 * expandir em tela cheia (com "Ver os Dados"/"Fechar") e "Ver Dados Detalhados"
 * (modal com tabela). O corpo do card (echarts) é responsabilidade de quem usa,
 * via render prop — cada gráfico gerencia sua própria instância/refs do echarts.
 *
 * Assume que o elemento pai (o item do grid) já fornece o "cartão" visual
 * (bg/borda/rounded) — este componente só cuida do cabeçalho, corpo e modais.
 */
export default function ChartCard({
  title,
  subtitle,
  detailData = [],
  detailColumns,
  detailForPoint,
  loadDetailForPoint,
  pointDetailColumns,
  detailGroupBy,
  detailTotalLabel,
  dragHandleClassName = 'widget-drag-handle',
  isDraggable = true,
  children,
}: ChartCardProps) {
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const hasDetailData = detailData.length > 0;
  const [selection, setSelection] = useState<{ title: string; data: unknown[] } | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | undefined>();
  const detailRequest = useRef(0);
  const openDetails = useCallback((point: ChartPoint) => {
    const requestId = ++detailRequest.current;
    // Séries sem nome recebem um identificador interno do ECharts com NUL.
    const seriesLabel = point.seriesName?.includes('\0') ? undefined : point.seriesName;
    const selectionTitle = [title, point.name, seriesLabel].filter(Boolean).join(' — ');
    setDetailError(undefined);
    setIsFullscreenOpen(false);
    setIsDataModalOpen(true);
    if (loadDetailForPoint) {
      setSelection({ title: selectionTitle, data: [] });
      setIsDetailLoading(true);
      void loadDetailForPoint(point).then(data => {
        if (detailRequest.current === requestId) setSelection({ title: selectionTitle, data });
      }).catch((error: unknown) => {
        if (detailRequest.current === requestId) {
          setDetailError(error instanceof Error ? error.message : 'Não foi possível carregar os lançamentos.');
        }
      }).finally(() => {
        if (detailRequest.current === requestId) setIsDetailLoading(false);
      });
      return;
    }
    setIsDetailLoading(false);
    const data = detailForPoint ? detailForPoint(point) : point.seriesType === 'gauge'
      ? detailData : detailData[point.dataIndex] ? [detailData[point.dataIndex]] : [];
    setSelection({ title: selectionTitle, data });
  }, [detailForPoint, loadDetailForPoint, detailData, title]);

  const openDataModal = () => {
    ++detailRequest.current;
    setIsDetailLoading(false);
    setDetailError(undefined);
    setSelection(null);
    setIsFullscreenOpen(false);
    setTimeout(() => setIsDataModalOpen(true), isFullscreenOpen ? 300 : 0);
  };

  return (
    <ChartDrilldownContext.Provider value={openDetails}>
      <div
        className={`${isDraggable ? `${dragHandleClassName} cursor-move` : ''} px-4 py-3 border-b border-ui-border-soft shrink-0 flex items-center justify-between gap-2`}
      >
        <h3 className="text-sm font-semibold text-content truncate">{title}</h3>
        <div className="flex gap-1 shrink-0" onMouseDown={(e) => e.stopPropagation()}>
          {hasDetailData && (
            <button
              onClick={openDataModal}
              className="p-1.5 rounded-md text-content-muted hover:text-content-secondary hover:bg-surface-subtle transition-colors"
              title="Ver Dados Detalhados"
              aria-label="Ver Dados Detalhados"
            >
              <FileText size={16} />
            </button>
          )}
          <button
            onClick={() => setIsFullscreenOpen(true)}
            className="p-1.5 rounded-md text-content-muted hover:text-content-secondary hover:bg-surface-subtle transition-colors"
            title="Expandir"
            aria-label="Expandir"
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>

      {/* O render prop recebe o callback de clique; a ref só é acessada ao clicar. */}
      {/* eslint-disable-next-line react-hooks/refs */}
      <div className="flex-1 relative min-h-0">{children({ isFullscreen: false, openDetails })}</div>

      <DataModal
        isOpen={isDataModalOpen}
        onClose={() => { ++detailRequest.current; setIsDataModalOpen(false); }}
        title={selection?.title ?? title}
        data={selection?.data ?? detailData}
        columns={selection && pointDetailColumns ? pointDetailColumns : detailColumns}
        isLoading={isDetailLoading}
        error={detailError}
        groupBy={detailGroupBy}
        totalLabel={selection && loadDetailForPoint ? 'lançamentos' : detailTotalLabel}
      />

      {isFullscreenOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9990] flex items-center justify-center bg-layer-overlay-strong backdrop-blur-xs p-2 sm:p-4"
          onClick={() => setIsFullscreenOpen(false)}
        >
          <div
            className="bg-surface border border-ui-border-soft rounded-2xl w-full max-w-6xl h-[90vh] sm:h-[85vh] flex flex-col shadow-2xl mx-2 sm:mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 sm:p-6 border-b border-ui-border-soft gap-3 sm:gap-0 shrink-0">
              <div className="w-full sm:w-auto">
                <h2 className="text-xl sm:text-2xl font-bold text-content">{title}</h2>
                {subtitle && <p className="text-content-muted text-sm mt-1">{subtitle}</p>}
              </div>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                {hasDetailData && (
                  <button
                    onClick={openDataModal}
                    className="px-3 sm:px-4 py-2 bg-brand text-content-inverse rounded-lg hover:bg-brand-hover transition-colors flex items-center gap-2 text-sm font-medium w-full sm:w-auto justify-center"
                  >
                    <FileText size={16} />
                    Ver os Dados
                  </button>
                )}
                <button
                  onClick={() => setIsFullscreenOpen(false)}
                  className="p-2 rounded-lg hover:bg-surface-subtle transition-colors text-content-muted hover:text-content-secondary"
                  title="Fechar"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 p-3 sm:p-4 md:p-5 relative bg-surface overflow-y-auto custom-scrollbar flex flex-col min-h-0">
              {/* eslint-disable-next-line react-hooks/refs -- callback executado apenas em eventos */}
              {children({ isFullscreen: true, openDetails })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </ChartDrilldownContext.Provider>
  );
}
