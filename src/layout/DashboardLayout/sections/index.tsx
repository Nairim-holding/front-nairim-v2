"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Filter } from "lucide-react";
import { MetricResponse } from "@/types/types";
import { MapCoordinate } from "@/lib/dashboard";
import { getPeriodRange, CLEARED_PERIOD_START } from "@/utils/periodRange";
import FinancialDashboardHeader from "@/components/dashboard/FinancialDashboardHeader";
import FinancialDashboardGrid, { WIDGET_LABELS, ALL_WIDGET_IDS } from "@/components/dashboard/FinancialDashboardGrid";
import PeriodFilterHeader from "@/components/dashboard/PeriodFilter";
import PortfolioDashboardGrid from "@/components/dashboard/PortfolioDashboardGrid";
import ClientsDashboardGrid from "@/components/dashboard/ClientsDashboardGrid";
import DynamicFilterModal from "@/components/filters/DynamicFilterModal";
import WidgetPersonalizer from "@/components/dashboard/WidgetPersonalizer";
import { useDynamicFilters } from "@/hooks/useDynamicFilters";
import { useWidgetVisibility } from "@/hooks/useWidgetVisibility";

export const SkeletonLoader = ({ height = "h-[240px]" }: { height?: string }) => (
  <div className={`bg-surface rounded-lg p-4 border border-ui-border-strong shadow-chart w-full cursor-pointer transition-all duration-300 flex flex-col justify-between animate-pulse ${height}`}>
    <div className="flex flex-col gap-3 flex-1">
      <div className="h-5 w-2/5 bg-surface-subtle rounded-md" />
      <div className="h-4 w-1/3 bg-surface-subtle rounded-md" />
      <div className="flex-1 bg-surface-subtle rounded-md mt-3" />
    </div>
  </div>
);

export const LeafletMap = dynamic(() => import("@/components/map/InteractiveMap"), { ssr: false, loading: () => <SkeletonLoader height="h-[600px]" /> });

/** Estado do filtro de período de uma aba: ano(s) + meses selecionados, o
 * intervalo resultante, e o aviso ao pai para rebuscar a seção quando o
 * período muda. Uma função só para as 4 abas usarem exatamente o mesmo filtro.
 *
 * Tarefa 5.3/6.1 (29/07/26): default é só o MÊS CORRENTE — não mais o ano
 * inteiro (mesmo default de getDefaultDateRange, para cabeçalho e dados
 * nascerem de acordo — antes de uma correção anterior o header dizia "Ano
 * inteiro" enquanto os dados eram só do mês).
 * Tarefa 5.2: `years` é um array — mais de um ano pode ser selecionado.
 * Tarefa 6.3: "Limpar período" pega todo o histórico disponível. */
function useSectionPeriod(onRangeChange: (startDate: string, endDate: string) => void) {
  const [years, setYears] = useState<number[]>(() => [new Date().getFullYear()]);
  const [selectedMonths, setSelectedMonths] = useState<number[]>(() => [new Date().getMonth() + 1]);
  const [isCleared, setIsCleared] = useState(false);

  const { startDate, endDate } = useMemo(() => {
    if (isCleared) {
      const today = new Date().toISOString().split('T')[0];
      return { startDate: CLEARED_PERIOD_START, endDate: today };
    }
    return getPeriodRange(years, selectedMonths);
  }, [years, selectedMonths, isCleared]);

  // Trocar o ano/mês (ou aplicar/tirar o "limpar período") sai do modo limpo automaticamente.
  const changeYears = (next: number[]) => { setIsCleared(false); setYears(next); };
  const changeMonths = (next: number[]) => { setIsCleared(false); setSelectedMonths(next); };
  const clearPeriod = () => setIsCleared(true);

  // Na primeira renderização os dados já vieram do fetch inicial com este mesmo
  // período — rebuscar aqui seria uma segunda chamada idêntica.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    onRangeChange(startDate, endDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  return {
    years, setYears: changeYears,
    selectedMonths, setSelectedMonths: changeMonths,
    isCleared, clearPeriod,
    // Ano "principal" para gráficos que só fazem sentido com um único ano
    // (ex.: linha do tempo de 12 meses) — o mais recente selecionado.
    primaryYear: Math.max(...years),
    startDate, endDate,
  };
}

/** Moldura comum das abas: fundo levemente afundado atrás do cabeçalho + grid. */
function SectionShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full bg-[#f8fafc] dark:bg-surface-subtle/30 p-3 sm:p-4 rounded-2xl border border-slate-200/60 dark:border-ui-border-soft/40 transition-colors">
      {children}
    </div>
  );
}

export function FinancialSection({
  metrics,
  onRangeChange,
}: {
  metrics: MetricResponse;
  onRangeChange: (startDate: string, endDate: string) => void;
}) {
  // Dono do período aqui (não no header) para que os gráficos do grid recebam o
  // mesmo período — antes cada um usava seu próprio "mês atual" hardcoded.
  const { years, setYears, selectedMonths, setSelectedMonths, isCleared, clearPeriod, primaryYear, startDate, endDate } =
    useSectionPeriod(onRangeChange);

  // Tarefa 5.1 (29/07/26): botão Filtro, mesmo componente/endpoint de Lançamentos
  // — reflete nos gráficos de transações (Receitas e Despesas, Realizado VS
  // Planejado, % por Categoria, Detalhamento por Subcategoria).
  const [appliedFilters, setAppliedFilters] = useState<Record<string, unknown>>({});
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const { filters: dynamicFilters } = useDynamicFilters('/financial-transaction/filters', appliedFilters);
  const activeFilterCount = Object.keys(appliedFilters).length;

  const handleApplyFilters = useCallback((f: Record<string, unknown>) => {
    setAppliedFilters(f);
    setIsFilterVisible(false);
  }, []);
  const handleClearFilters = useCallback(() => {
    setAppliedFilters({});
    setIsFilterVisible(false);
  }, []);

  // Tarefa 10 (29/07/26): botão "Personalizar Gráficos" ao lado do Filtro.
  const { visibleWidgetIds, setVisibleWidgetIds } = useWidgetVisibility('financeiro-v5', ALL_WIDGET_IDS);

  return (
    <SectionShell>
      <div className="flex items-start gap-2 mb-1">
        <button
          type="button"
          onClick={() => setIsFilterVisible(true)}
          className="relative mt-1 p-2 rounded-lg border border-ui-border-soft bg-surface text-content-muted hover:text-content hover:bg-surface-subtle transition-colors shrink-0"
          title="Filtro"
        >
          <Filter size={16} color={activeFilterCount > 0 ? 'var(--color-brand-primary)' : undefined} />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-brand text-content-inverse text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
        <div className="mt-1 shrink-0">
          <WidgetPersonalizer
            widgets={ALL_WIDGET_IDS.map((id) => ({ id, label: WIDGET_LABELS[id] }))}
            visibleWidgetIds={visibleWidgetIds}
            onChange={setVisibleWidgetIds}
          />
        </div>
        <div className="flex-1 min-w-0">
          {/* Só o Financeiro usa este header: é o seletor de período padrão MAIS os
              totais de Receitas/Despesas/Resultado, que só existem nesta aba. */}
          <FinancialDashboardHeader
            years={years}
            selectedMonths={selectedMonths}
            onYearsChange={setYears}
            onMonthsChange={setSelectedMonths}
            isCleared={isCleared}
            onClear={clearPeriod}
          />
        </div>
      </div>
      <FinancialDashboardGrid
        legacyMetrics={metrics}
        year={primaryYear}
        years={years}
        startDate={startDate}
        endDate={endDate}
        filters={appliedFilters}
        visibleWidgetIds={visibleWidgetIds}
      />

      {isFilterVisible && (
        <DynamicFilterModal
          visible={isFilterVisible}
          setVisible={setIsFilterVisible}
          onApply={handleApplyFilters}
          onClear={handleClearFilters}
          title="Resumo Financeiro"
          filters={dynamicFilters}
          initialValues={appliedFilters}
          columns={3}
        />
      )}
    </SectionShell>
  );
}

export function PortfolioSection({
  metrics,
  onRangeChange,
}: {
  metrics: MetricResponse;
  onRangeChange: (startDate: string, endDate: string) => void;
}) {
  const { years, setYears, selectedMonths, setSelectedMonths, isCleared, clearPeriod } = useSectionPeriod(onRangeChange);

  return (
    <SectionShell>
      <PeriodFilterHeader
        years={years}
        selectedMonths={selectedMonths}
        onYearsChange={setYears}
        onMonthsChange={setSelectedMonths}
        isCleared={isCleared}
        onClear={clearPeriod}
      />
      <PortfolioDashboardGrid metrics={metrics} />
    </SectionShell>
  );
}

export function ClientsSection({
  metrics,
  onRangeChange,
}: {
  metrics: MetricResponse;
  onRangeChange: (startDate: string, endDate: string) => void;
}) {
  const { years, setYears, selectedMonths, setSelectedMonths, isCleared, clearPeriod, startDate, endDate } =
    useSectionPeriod(onRangeChange);

  return (
    <SectionShell>
      <PeriodFilterHeader
        years={years}
        selectedMonths={selectedMonths}
        onYearsChange={setYears}
        onMonthsChange={setSelectedMonths}
        isCleared={isCleared}
        onClear={clearPeriod}
      />
      <ClientsDashboardGrid metrics={metrics} startDate={startDate} endDate={endDate} />
    </SectionShell>
  );
}

export function MapSection({
  data,
  onRangeChange,
}: {
  data: MapCoordinate[];
  onRangeChange: (startDate: string, endDate: string) => void;
}) {
  const { years, setYears, selectedMonths, setSelectedMonths, isCleared, clearPeriod } = useSectionPeriod(onRangeChange);

  return (
    <SectionShell>
      <PeriodFilterHeader
        years={years}
        selectedMonths={selectedMonths}
        onYearsChange={setYears}
        onMonthsChange={setSelectedMonths}
        isCleared={isCleared}
        onClear={clearPeriod}
      />
      <LeafletMap data={data} />
    </SectionShell>
  );
}