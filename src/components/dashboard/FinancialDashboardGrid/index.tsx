'use client';

import { useCallback, type ComponentType } from 'react';
import { DashboardLayoutItem } from '@/hooks/useDashboardLayout';
import DashboardWidgetGrid, { type DashboardWidget } from '@/components/dashboard/DashboardWidgetGrid';
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

const DEFAULT_LAYOUT: DashboardLayoutItem[] = [
  { i: 'widget-11', x: 0, y: 0, w: 4, h: 3 },
  { i: 'widget-12', x: 4, y: 0, w: 4, h: 3 },
  { i: 'widget-13', x: 8, y: 0, w: 4, h: 3 },
  { i: 'widget-14', x: 0, y: 3, w: 4, h: 3 },
  { i: 'widget-16', x: 4, y: 3, w: 4, h: 3 },
  { i: 'widget-15', x: 8, y: 3, w: 4, h: 3 },
  { i: 'widget-1', x: 0, y: 6, w: 8, h: 8 },
  { i: 'widget-2', x: 8, y: 6, w: 4, h: 8 },
  { i: 'widget-7', x: 0, y: 14, w: 6, h: 8 },
  { i: 'widget-8', x: 6, y: 14, w: 6, h: 8 },
  { i: 'widget-3', x: 0, y: 22, w: 6, h: 8 },
  { i: 'widget-10', x: 6, y: 22, w: 6, h: 8 },
  { i: 'widget-9', x: 0, y: 30, w: 12, h: 11 },
];

/** Corrige layouts já salvos por usuários com a altura antiga destes widgets. */
const normalizeItem = (item: DashboardLayoutItem): DashboardLayoutItem => {
  if (item.i === 'widget-15' && item.h !== 3) return { ...item, h: 3 };
  if (item.i === 'widget-9' && item.h !== 11) return { ...item, h: 11 };
  return item;
};

interface FinancialDashboardGridProps extends FinancialWidgetProps {
  resource?: string;
  /** Métricas de portfólio/imóveis para os widgets que já existiam no financeiro. */
  legacyMetrics?: MetricResponse | null;
}

export default function FinancialDashboardGrid({
  resource = 'financeiro-v5',
  legacyMetrics = null,
  year,
  startDate,
  endDate,
}: FinancialDashboardGridProps) {
  const renderWidget = useCallback(
    (id: string): DashboardWidget | null => {
      const RealWidget = REAL_WIDGETS[id];
      if (RealWidget) {
        return {
          body: <RealWidget year={year} startDate={startDate} endDate={endDate} />,
          framed: true,
          // Este card tem dropdown de categoria, que precisa escapar do cartão.
          overflowVisible: id === 'widget-10',
        };
      }

      const LegacyWidget = LEGACY_WIDGETS[id];
      if (LegacyWidget) {
        return { body: <LegacyWidget metrics={legacyMetrics} />, framed: false };
      }

      return null;
    },
    [year, startDate, endDate, legacyMetrics]
  );

  return (
    <DashboardWidgetGrid
      resource={resource}
      defaultLayout={DEFAULT_LAYOUT}
      renderWidget={renderWidget}
      normalizeItem={normalizeItem}
    />
  );
}
