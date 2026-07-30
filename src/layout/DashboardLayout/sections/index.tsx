"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { MetricResponse } from "@/types/types";
import { MapCoordinate } from "@/lib/dashboard";
import { getPeriodRange } from "@/utils/periodRange";
import FinancialDashboardHeader from "@/components/dashboard/FinancialDashboardHeader";
import FinancialDashboardGrid from "@/components/dashboard/FinancialDashboardGrid";
import PeriodFilterHeader from "@/components/dashboard/PeriodFilter";
import PortfolioDashboardGrid from "@/components/dashboard/PortfolioDashboardGrid";
import ClientsDashboardGrid from "@/components/dashboard/ClientsDashboardGrid";

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

/** Estado do filtro de período de uma aba: ano + meses selecionados, o intervalo
 * resultante, e o aviso ao pai para rebuscar a seção quando o período muda.
 * Uma função só para as 4 abas usarem exatamente o mesmo filtro. */
function useSectionPeriod(onRangeChange: (startDate: string, endDate: string) => void) {
  const [year, setYear] = useState(() => new Date().getFullYear());
  // Inicia com o ano inteiro (não só o mês atual): é o mesmo default do
  // getDefaultDateRange do fetch, então cabeçalho e dados já nascem de acordo.
  const [selectedMonths, setSelectedMonths] = useState<number[]>(
    Array.from({ length: 12 }, (_, i) => i + 1)
  );

  const { startDate, endDate } = useMemo(() => getPeriodRange(year, selectedMonths), [year, selectedMonths]);

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

  return { year, setYear, selectedMonths, setSelectedMonths, startDate, endDate };
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
  const { year, setYear, selectedMonths, setSelectedMonths, startDate, endDate } =
    useSectionPeriod(onRangeChange);

  return (
    <SectionShell>
      {/* Só o Financeiro usa este header: é o seletor de período padrão MAIS os
          totais de Receitas/Despesas/Resultado, que só existem nesta aba. */}
      <FinancialDashboardHeader
        year={year}
        selectedMonths={selectedMonths}
        onYearChange={setYear}
        onMonthsChange={setSelectedMonths}
      />
      <FinancialDashboardGrid legacyMetrics={metrics} year={year} startDate={startDate} endDate={endDate} />
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
  const { year, setYear, selectedMonths, setSelectedMonths } = useSectionPeriod(onRangeChange);

  return (
    <SectionShell>
      <PeriodFilterHeader
        year={year}
        selectedMonths={selectedMonths}
        onYearChange={setYear}
        onMonthsChange={setSelectedMonths}
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
  const { year, setYear, selectedMonths, setSelectedMonths, startDate, endDate } =
    useSectionPeriod(onRangeChange);

  return (
    <SectionShell>
      <PeriodFilterHeader
        year={year}
        selectedMonths={selectedMonths}
        onYearChange={setYear}
        onMonthsChange={setSelectedMonths}
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
  const { year, setYear, selectedMonths, setSelectedMonths } = useSectionPeriod(onRangeChange);

  return (
    <SectionShell>
      <PeriodFilterHeader
        year={year}
        selectedMonths={selectedMonths}
        onYearChange={setYear}
        onMonthsChange={setSelectedMonths}
      />
      <LeafletMap data={data} />
    </SectionShell>
  );
}