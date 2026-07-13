'use client';

import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import GridLayout, { WidthProvider, type Layout } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useDashboardLayout, DashboardLayoutItem } from '@/hooks/useDashboardLayout';
import { MetricResponse } from '@/types/types';
import MonthlyIncomeExpenseChart from '@/components/dashboard/MonthlyIncomeExpenseChart';
import ExpenseRatioChart from '@/components/dashboard/ExpenseRatioChart';
import ExpenseByCategoryChart from '@/components/dashboard/ExpenseByCategoryChart';
import RealizedVsPlannedChart from '@/components/dashboard/RealizedVsPlannedChart';
import CardUsageChart from '@/components/dashboard/CardUsageChart';
import AccountBalanceChart from '@/components/dashboard/AccountBalanceChart';
import SubcategoryBreakdownChart from '@/components/dashboard/SubcategoryBreakdownChart';
import {
  AvgRentalWidget, TotalRentalWidget, TaxFeeWidget, AcquisitionWidget,
  VacancyGaugeWidget, VacancyMonthsWidget,
} from './LegacyPortfolioWidgets';
import { FinancialWidgetProps } from './types';

const ResponsiveGridLayout = WidthProvider(GridLayout);

const ROW_HEIGHT = 40;
const GRID_GAP = 16;
/** Abaixo disso, o grid arrastável de 12 colunas fica ilegível (colunas
 * viram tiras estreitas) — troca para uma lista empilhada de largura total,
 * sem drag/resize (não faz sentido em touch de qualquer forma). */
const MOBILE_BREAKPOINT_PX = 768;

function useIsMobile(breakpointPx: number): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    setIsMobile(mql.matches);
    const handleChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, [breakpointPx]);

  return isMobile;
}

// Widgets com gráfico real já conectado. Todos recebem o mesmo período
// (year/startDate/endDate) do filtro único da aba — quem não precisa de uma
// das props (ex.: AccountBalanceChart, que é um saldo atual, não histórico)
// simplesmente a ignora.
const REAL_WIDGETS: Record<string, ComponentType<FinancialWidgetProps>> = {
  'widget-1': MonthlyIncomeExpenseChart,
  'widget-2': ExpenseRatioChart,
  'widget-3': ExpenseByCategoryChart,
  'widget-7': RealizedVsPlannedChart,
  'widget-8': CardUsageChart,
  'widget-9': AccountBalanceChart,
  'widget-10': SubcategoryBreakdownChart,
};

// Widgets que já existiam no financeiro antes desta etapa (cards de portfólio da
// aba Financeiro) — precisam de `metrics` vindo de fora, diferente dos widgets
// acima, que buscam os próprios dados.
const LEGACY_WIDGETS: Record<string, ComponentType<{ metrics: MetricResponse | null }>> = {
  'widget-11': AvgRentalWidget,
  'widget-12': TotalRentalWidget,
  'widget-13': TaxFeeWidget,
  'widget-14': AcquisitionWidget,
  'widget-15': VacancyGaugeWidget,
  'widget-16': VacancyMonthsWidget,
};

const KNOWN_WIDGET_IDS = new Set([...Object.keys(REAL_WIDGETS), ...Object.keys(LEGACY_WIDGETS)]);

const DEFAULT_LAYOUT: DashboardLayoutItem[] = [
  { i: 'widget-11', x: 0, y: 0, w: 4, h: 3 },
  { i: 'widget-12', x: 4, y: 0, w: 4, h: 3 },
  { i: 'widget-13', x: 8, y: 0, w: 4, h: 3 },
  { i: 'widget-14', x: 0, y: 3, w: 4, h: 3 },
  { i: 'widget-16', x: 4, y: 3, w: 4, h: 3 },
  { i: 'widget-15', x: 8, y: 3, w: 4, h: 3 },
  { i: 'widget-1', x: 0, y: 9, w: 12, h: 6 },
  { i: 'widget-3', x: 0, y: 15, w: 12, h: 6 },
  { i: 'widget-2', x: 0, y: 21, w: 6, h: 6 },
  { i: 'widget-7', x: 6, y: 21, w: 6, h: 8 },
  { i: 'widget-8', x: 0, y: 29, w: 6, h: 8 },
  { i: 'widget-9', x: 6, y: 29, w: 6, h: 8 },
  { i: 'widget-10', x: 0, y: 37, w: 6, h: 8 },
];

interface FinancialDashboardGridProps extends FinancialWidgetProps {
  resource?: string;
  /** Métricas de portfólio/imóveis para os widgets que já existiam no financeiro. */
  legacyMetrics?: MetricResponse | null;
}

export default function FinancialDashboardGrid({ resource = 'financeiro', legacyMetrics = null, year, startDate, endDate }: FinancialDashboardGridProps) {
  const { layout, isLoading, saveLayout } = useDashboardLayout(resource, DEFAULT_LAYOUT);
  const isMobile = useIsMobile(MOBILE_BREAKPOINT_PX);

  // Reconcilia o layout salvo com o conjunto atual de widgets: descarta ids que
  // não existem mais (ex.: placeholders antigos) e acrescenta ao final os que o
  // usuário ainda não tem salvos (ex.: widgets novos adicionados em uma release).
  // Sem isso, layouts salvos antes de uma mudança de widgets renderizam cards
  // vazios/quebrados ou simplesmente não mostram os gráficos novos.
  const displayLayout = useMemo(() => {
    // widget-15 (gauge) precisa ficar do mesmo tamanho dos cards vizinhos
    // (h:3) — corrige aqui qualquer layout já salvo por um usuário com a
    // altura antiga (h:6, de uma versão anterior deste widget).
    const known = layout
      .filter((item) => KNOWN_WIDGET_IDS.has(item.i))
      .map((item) => (item.i === 'widget-15' && item.h !== 3 ? { ...item, h: 3 } : item));
    const present = new Set(known.map((item) => item.i));
    const bottom = known.reduce((max, item) => Math.max(max, item.y + item.h), 0);
    const missing = DEFAULT_LAYOUT
      .filter((d) => !present.has(d.i))
      .map((d) => ({ ...d, y: bottom + d.y }));
    return [...known, ...missing];
  }, [layout]);

  const handleLayoutChange = useCallback(
    (newLayout: Layout) => {
      saveLayout(newLayout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })));
    },
    [saveLayout]
  );

  const renderWidgetBody = useCallback(
    (id: string) => {
      const RealWidget = REAL_WIDGETS[id];
      if (RealWidget) return <RealWidget year={year} startDate={startDate} endDate={endDate} />;

      const LegacyWidget = LEGACY_WIDGETS[id];
      if (LegacyWidget) return <LegacyWidget metrics={legacyMetrics} />;

      return null;
    },
    [year, startDate, endDate, legacyMetrics]
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
      </div>
    );
  }

  // Em telas estreitas o grid arrastável de 12 colunas fica ilegível (cada
  // coluna vira uma tira estreita demais para os gráficos). Sem drag/resize
  // (sem sentido em touch), lista simplesmente empilhada de largura total,
  // preservando a altura relativa de cada widget (h * linha) do layout salvo.
  if (isMobile) {
    return (
      <div className="flex flex-col gap-4 w-full">
        {displayLayout.map((item) => {
          const body = renderWidgetBody(item.i);
          if (!body) return null;
          const isLegacy = Boolean(LEGACY_WIDGETS[item.i]);
          const heightPx = item.h * ROW_HEIGHT + (item.h - 1) * GRID_GAP;
          return (
            <div
              key={item.i}
              style={{ height: heightPx }}
              className={
                isLegacy
                  ? 'w-full'
                  : 'w-full bg-surface rounded-xl border border-ui-border-soft shadow-sm overflow-hidden flex flex-col'
              }
            >
              {body}
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
      draggableHandle=".widget-drag-handle"
      onLayoutChange={handleLayoutChange}
    >
      {displayLayout.map((item) => {
        const body = renderWidgetBody(item.i);
        if (!body) return null;
        const isLegacy = Boolean(LEGACY_WIDGETS[item.i]);
        return (
          <div
            key={item.i}
            className={
              isLegacy
                // Sem wrapper bg-surface aqui: estes widgets já têm moldura própria
                // completa (NumericCard/EChartsGauge) — duplicar geraria card-dentro-de-card.
                ? 'h-full'
                : 'bg-surface rounded-xl border border-ui-border-soft shadow-sm overflow-hidden flex flex-col'
            }
          >
            {body}
          </div>
        );
      })}
    </ResponsiveGridLayout>
  );
}
