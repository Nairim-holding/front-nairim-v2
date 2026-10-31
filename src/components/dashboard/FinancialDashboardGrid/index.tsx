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
import ResumoReceitasChart from '@/components/dashboard/ResumoReceitasChart';
import ResumoDespesasChart from '@/components/dashboard/ResumoDespesasChart';
import YearlyIncomeExpenseChart from '@/components/dashboard/YearlyIncomeExpenseChart';
import CenterIncomeExpenseChart from '@/components/dashboard/CenterIncomeExpenseChart';
import WidgetPersonalizer from '@/components/dashboard/WidgetPersonalizer';
import DashboardDemonstrativoWidget from './DashboardDemonstrativoWidget';
import { useWidgetVisibility } from '@/hooks/useWidgetVisibility';
import {
  AvgRentalWidget, TotalRentalWidget,
} from './LegacyPortfolioWidgets';
import TaxesWidget from './TaxesWidget';
import { FinancialWidgetProps } from './types';
import { formatPeriodLabel } from '@/utils/periodRange';

// Tarefa 10 (29/07/26): rótulos para o modal "Personalizar Gráficos".
export const WIDGET_LABELS: Record<string, string> = {
  'widget-20': 'Receitas e Despesas por Centro',
  'widget-11': 'Ticket Médio da Locação',
  'widget-12': 'Valor Total de Aluguel do Portfólio',
  'widget-13': 'Total de Impostos e Taxas',
  'widget-1': 'Receitas e Despesas',
  'widget-2': '% Despesas em Relação às Receitas',
  'widget-7': 'Despesas: Realizado VS Planejado',
  'widget-8': 'Gastos com Cartões de Crédito',
  'widget-3': '% por Categoria de Gasto em Relação à Receita',
  'widget-10': 'Detalhamento de Gastos por Subcategorias',
  'widget-9': 'Saldo por Conta',
  'widget-17': 'Resumo das Receitas',
  'widget-18': 'Resumo das Despesas',
  'widget-19': 'Receitas VS Despesas por Ano',
  'widget-21': 'Demonstrativo Financeiro',
};

// Widgets com gráfico real já conectado. Todos recebem o mesmo período
// (year/startDate/endDate) do filtro único da aba — quem não precisa de uma
// das props (ex.: AccountBalanceChart, que é um saldo atual, não histórico)
// simplesmente a ignora.
const REAL_WIDGETS: Record<string, ComponentType<FinancialWidgetProps>> = {
  'widget-20': CenterIncomeExpenseChart,
  'widget-1': MonthlyIncomeExpenseChart,
  'widget-2': ExpenseRatioChart,
  'widget-3': ExpenseByCategoryChart,
  'widget-7': RealizedVsPlannedChart,
  'widget-8': CardUsageChart,
  'widget-9': AccountBalanceChart,
  'widget-10': SubcategoryBreakdownChart,
  'widget-17': ResumoReceitasChart,
  'widget-18': ResumoDespesasChart,
  'widget-19': YearlyIncomeExpenseChart,
  'widget-21': DashboardDemonstrativoWidget,
};

// Widgets que já existiam no financeiro antes desta etapa (cards de portfólio da
// aba Financeiro) — precisam de `metrics` vindo de fora, diferente dos widgets
// acima, que buscam os próprios dados.
const LEGACY_WIDGETS: Record<string, ComponentType<{ metrics: MetricResponse | null; periodLabel?: string }>> = {
  'widget-11': AvgRentalWidget,
  'widget-12': TotalRentalWidget,
};

const DEFAULT_LAYOUT: DashboardLayoutItem[] = [
  { i: 'widget-11', x: 0, y: 0, w: 4, h: 3 },
  { i: 'widget-12', x: 4, y: 0, w: 4, h: 3 },
  { i: 'widget-13', x: 8, y: 0, w: 4, h: 3 },
  { i: 'widget-1', x: 0, y: 6, w: 8, h: 8 },
  { i: 'widget-2', x: 8, y: 6, w: 4, h: 8 },
  { i: 'widget-7', x: 0, y: 14, w: 6, h: 8 },
  { i: 'widget-8', x: 6, y: 14, w: 6, h: 8 },
  { i: 'widget-3', x: 0, y: 22, w: 6, h: 8 },
  { i: 'widget-10', x: 6, y: 22, w: 6, h: 8 },
  { i: 'widget-9', x: 0, y: 30, w: 12, h: 11 },
  { i: 'widget-17', x: 0, y: 41, w: 6, h: 8 },
  { i: 'widget-18', x: 6, y: 41, w: 6, h: 8 },
  { i: 'widget-19', x: 0, y: 49, w: 12, h: 9 },
  { i: 'widget-20', x: 0, y: 58, w: 12, h: 10 },
  { i: 'widget-21', x: 0, y: 68, w: 12, h: 18 },
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
  /**
   * Tarefa 10 (29/07/26): quando o pai controla a visibilidade (FinancialSection,
   * que desenha o botão "Personalizar Gráficos" ao lado do Filtro), a grid usa
   * esse valor em vez de gerenciar seu próprio estado/botão.
   */
  visibleWidgetIds?: string[];
}

export const ALL_WIDGET_IDS = Object.keys(WIDGET_LABELS);

export default function FinancialDashboardGrid({
  resource = 'financeiro-v5',
  legacyMetrics = null,
  year,
  years,
  startDate,
  endDate,
  filters,
  visibleWidgetIds: visibleWidgetIdsProp,
}: FinancialDashboardGridProps) {
  const ownVisibility = useWidgetVisibility(resource, ALL_WIDGET_IDS, ['widget-21']);
  const visibleWidgetIds = visibleWidgetIdsProp ?? ownVisibility.visibleWidgetIds;
  const isExternallyControlled = visibleWidgetIdsProp !== undefined;

  const renderWidget = useCallback(
    (id: string): DashboardWidget | null => {
      if (!visibleWidgetIds.includes(id)) return null;

      const RealWidget = REAL_WIDGETS[id];
      if (RealWidget) {
        return {
          body: <RealWidget key={String(filters?.regime ?? 'caixa')} year={year} years={years} startDate={startDate} endDate={endDate} filters={filters} />,
          framed: true,
          // Este card tem dropdown de categoria, que precisa escapar do cartão.
          overflowVisible: id === 'widget-10',
        };
      }

      // Impostos e Taxas vem dos lançamentos (linha Impostos do Demonstrativo),
      // não mais da estimativa por imóvel; tem moldura própria (NumericCard).
      if (id === 'widget-13') {
        return {
          body: <TaxesWidget key={String(filters?.regime ?? 'caixa')} year={year} years={years} startDate={startDate} endDate={endDate} filters={filters} />,
          framed: false,
        };
      }

      const LegacyWidget = LEGACY_WIDGETS[id];
      if (LegacyWidget) {
        return {
          body: <LegacyWidget metrics={legacyMetrics} periodLabel={formatPeriodLabel(startDate, endDate)} />,
          framed: false,
        };
      }

      return null;
    },
    [visibleWidgetIds, year, years, startDate, endDate, filters, legacyMetrics]
  );

  return (
    <div className="flex flex-col gap-2">
      {!isExternallyControlled && (
        <div className="flex justify-end">
          <WidgetPersonalizer
            widgets={ALL_WIDGET_IDS.map((id) => ({ id, label: WIDGET_LABELS[id] }))}
            visibleWidgetIds={visibleWidgetIds}
            onChange={ownVisibility.setVisibleWidgetIds}
          />
        </div>
      )}
      <DashboardWidgetGrid
        resource={resource}
        defaultLayout={DEFAULT_LAYOUT}
        renderWidget={renderWidget}
        normalizeItem={normalizeItem}
      />
    </div>
  );
}
