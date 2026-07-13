/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { MetricResponse, MetricWithData } from "@/types/types";
import NumericCard from "@/components/charts/MetricCard";
import {
  COLS_TOTAL_PROPERTIES, COLS_PENDING_DOCS, COLS_SALE_VALUE,
  COLS_AVAILABILITY_DONUT, COLS_TYPES_DONUT, COLS_OCCUPATION_GAUGE, COLS_VACANCY_GAUGE,
  COLS_OWNERS, COLS_TENANTS, COLS_PROPERTIES_PER_OWNER, COLS_AGENCIES, COLS_PROPERTIES_BY_AGENCY,
} from "@/lib/columns";
import { MapCoordinate } from "@/lib/dashboard";
import { getPeriodRange } from "@/utils/periodRange";
import FinancialDashboardHeader from "@/components/dashboard/FinancialDashboardHeader";
import FinancialDashboardGrid from "@/components/dashboard/FinancialDashboardGrid";

export const SkeletonLoader = ({ height = "h-[240px]" }: { height?: string }) => (
  <div className={`bg-surface rounded-lg p-4 border border-ui-border-strong shadow-chart w-full cursor-pointer transition-all duration-300 flex flex-col justify-between animate-pulse ${height}`}>
    <div className="flex flex-col gap-3 flex-1">
      <div className="h-5 w-2/5 bg-surface-subtle rounded-md" />
      <div className="h-4 w-1/3 bg-surface-subtle rounded-md" />
      <div className="flex-1 bg-surface-subtle rounded-md mt-3" />
    </div>
  </div>
);

export const EChartsDonut = dynamic(() => import("@/components/charts/DonutChart"), { ssr: false, loading: () => <SkeletonLoader /> });
export const EChartsGauge  = dynamic(() => import("@/components/charts/GaugeChart"),  { ssr: false, loading: () => <SkeletonLoader /> });
export const EChartsBar    = dynamic(() => import("@/components/charts/BarChart"),    { ssr: false, loading: () => <SkeletonLoader /> });
export const LeafletMap    = dynamic(() => import("@/components/map/InteractiveMap"),    { ssr: false, loading: () => <SkeletonLoader height="h-[600px]" /> });

type MetricDataKeys = {
  [K in keyof MetricResponse]: MetricResponse[K] extends MetricWithData ? K : never;
}[keyof MetricResponse];

function useMetricGetter(metrics: MetricResponse | null) {
  return (k: MetricDataKeys): MetricWithData =>
    ((metrics?.[k] as MetricWithData) ?? { result: 0, variation: 0, isPositive: false, data: [] });
}

export function FinancialSection({
  metrics,
  onRangeChange,
}: {
  metrics: MetricResponse;
  onRangeChange: (startDate: string, endDate: string) => void;
}) {
  const currentYear = new Date().getFullYear();

  // Único filtro de período da aba: dono aqui (não no header) para que os
  // gráficos "reais" do grid (que antes usavam cada um seu próprio "mês
  // atual" hardcoded) também recebam o mesmo período — antes só os widgets
  // legados (portfólio) respeitavam o filtro, os gráficos novos ignoravam.
  const [year, setYear] = useState(currentYear);
  // Painel inicia com o ano inteiro selecionado (não só o mês atual), igual ao
  // que o botão "Selecionar ano inteiro" already faz manualmente.
  const [selectedMonths, setSelectedMonths] = useState<number[]>(
    Array.from({ length: 12 }, (_, i) => i + 1)
  );

  const { startDate, endDate } = useMemo(() => getPeriodRange(year, selectedMonths), [year, selectedMonths]);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    onRangeChange(startDate, endDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  return (
    <div className="w-full">
      <FinancialDashboardHeader
        year={year}
        selectedMonths={selectedMonths}
        onYearChange={setYear}
        onMonthsChange={setSelectedMonths}
      />
      <FinancialDashboardGrid legacyMetrics={metrics} year={year} startDate={startDate} endDate={endDate} />
    </div>
  );
}

export function PortfolioSection({ metrics }: { metrics: MetricResponse }) {
  const get = useMetricGetter(metrics);

  const vacancyData = useMemo(
    () => (get("vacancyRate").data ?? []).map((item: any) => ({ ...item, status: "AVAILABLE", areaTotal: item.areaTotal ?? 0 })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [metrics]
  );

  const occupationData = useMemo(
    () => (get("occupationRate").data ?? []).map((item: any) => ({ ...item, status: item.status || "OCCUPIED" })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [metrics]
  );

  const typesData = useMemo(
    () => ((metrics.availablePropertiesByType as any[]) ?? []).map((group) => ({
      ...group,
      data: group.data?.map((item: any) => ({ ...item })),
    })),
    [metrics]
  );

  const availabilityDonutData = useMemo(() => [
    { name: "Disponíveis", value: get("vacancyRate").result,   data: vacancyData },
    { name: "Ocupados",    value: get("occupationRate").result, data: occupationData },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [vacancyData, occupationData]);

  return (
    <>
      <NumericCard value={String(get("totalPropertys").result)}                label="Total de Imóveis"                     variation={String(get("totalPropertys").variation)}                positive={get("totalPropertys").isPositive}                detailData={get("totalPropertys").data}                detailColumns={COLS_TOTAL_PROPERTIES} />
      <NumericCard value={String(get("countPropertiesWithLessThan3Docs").result)} label="Imóveis com Documentação Pendente"  variation={String(get("countPropertiesWithLessThan3Docs").variation)} positive={get("countPropertiesWithLessThan3Docs").isPositive} detailData={get("countPropertiesWithLessThan3Docs").data} detailColumns={COLS_PENDING_DOCS} />
      <NumericCard value={String(get("totalPropertiesWithSaleValue").result)}  label="Imóveis com Valor de Venda Definido"  variation={String(get("totalPropertiesWithSaleValue").variation)}  positive={get("totalPropertiesWithSaleValue").isPositive}  detailData={get("totalPropertiesWithSaleValue").data}  detailColumns={COLS_SALE_VALUE} />
      <EChartsDonut data={availabilityDonutData} label="Imóveis por Status de Disponibilidade" detailColumns={COLS_AVAILABILITY_DONUT} />
      <EChartsDonut data={typesData} label="Imóveis na Carteira" colors={["#FF7777","#77FF7B","#F9FF53","#77A2FF","#E477FF"]} detailColumns={COLS_TYPES_DONUT} />
      <EChartsGauge label="Taxa de Ocupação"       value={get("occupationRate").result} color="#10B981" detailData={get("occupationRate").data} detailColumns={COLS_OCCUPATION_GAUGE} />
      <EChartsGauge label="Taxa de Vacância Física" value={get("vacancyRate").result}   color="#EF4444" detailData={get("vacancyRate").data}   detailColumns={COLS_VACANCY_GAUGE} />
    </>
  );
}

export function ClientsSection({ metrics }: { metrics: MetricResponse }) {
  const get = useMetricGetter(metrics);

  return (
    <>
      <NumericCard value={String(get("ownersTotal").result)}          label="Total de Proprietários"             variation={String(get("ownersTotal").variation)}          positive={get("ownersTotal").isPositive}          detailData={get("ownersTotal").data}          detailColumns={COLS_OWNERS} />
      <NumericCard value={String(get("tenantsTotal").result)}         label="Total de Inquilinos"                variation={String(get("tenantsTotal").variation)}         positive={get("tenantsTotal").isPositive}         detailData={get("tenantsTotal").data}         detailColumns={COLS_TENANTS} />
      <NumericCard value={get("propertiesPerOwner").result?.toFixed(2) || "0"} label="Média de Imóveis por Proprietário" variation={String(get("propertiesPerOwner").variation)} positive={get("propertiesPerOwner").isPositive} detailData={get("propertiesPerOwner").data} detailColumns={COLS_PROPERTIES_PER_OWNER} />
      <NumericCard value={String(get("agenciesTotal").result)}        label="Total de Imobiliárias"              variation={String(get("agenciesTotal").variation)}        positive={get("agenciesTotal").isPositive}        detailData={get("agenciesTotal").data}        detailColumns={COLS_AGENCIES} />
      <EChartsBar data={metrics.propertiesByAgency ?? []} label="Imóveis por Imobiliárias" detailColumns={COLS_PROPERTIES_BY_AGENCY} />
    </>
  );
}

export function MapSection({ data }: { data: MapCoordinate[] }) {
  return (
    <div className="w-full transition-all duration-300">
      <LeafletMap data={data} />
    </div>
  );
}