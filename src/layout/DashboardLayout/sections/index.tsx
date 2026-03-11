/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useMemo } from "react";
import dynamic from "next/dynamic";
import { MetricResponse, MetricWithData } from "@/types/types";
import NumericCard from "@/components/NumericCard";
import { formatCurrencyFixed, formatCurrencyRounded } from "@/lib/formatters";
import {
  COLS_AVG_RENTAL, COLS_TOTAL_RENTAL, COLS_TAX_FEE, COLS_ACQUISITION,
  COLS_FINANCIAL_VACANCY_GAUGE, COLS_VACANCY_MONTHS,
  COLS_TOTAL_PROPERTIES, COLS_PENDING_DOCS, COLS_SALE_VALUE,
  COLS_AVAILABILITY_DONUT, COLS_TYPES_DONUT, COLS_OCCUPATION_GAUGE, COLS_VACANCY_GAUGE,
  COLS_OWNERS, COLS_TENANTS, COLS_PROPERTIES_PER_OWNER, COLS_AGENCIES, COLS_PROPERTIES_BY_AGENCY,
} from "@/lib/columns";
import { MapCoordinate } from "@/lib/dashboard";

export const SkeletonLoader = ({ height = "h-[240px]" }: { height?: string }) => (
  <div className={`bg-surface rounded-lg p-4 border border-ui-border-strong shadow-chart w-full cursor-pointer transition-all duration-300 flex flex-col justify-between animate-pulse ${height}`}>
    <div className="flex flex-col gap-3 flex-1">
      <div className="h-5 w-2/5 bg-surface-subtle rounded-md" />
      <div className="h-4 w-1/3 bg-surface-subtle rounded-md" />
      <div className="flex-1 bg-surface-subtle rounded-md mt-3" />
    </div>
  </div>
);

export const EChartsDonut = dynamic(() => import("@/components/EChartsDonut"), { ssr: false, loading: () => <SkeletonLoader /> });
export const EChartsGauge  = dynamic(() => import("@/components/EChartsGauge"),  { ssr: false, loading: () => <SkeletonLoader /> });
export const EChartsBar    = dynamic(() => import("@/components/EChartsBar"),    { ssr: false, loading: () => <SkeletonLoader /> });
export const LeafletMap    = dynamic(() => import("@/components/LeafletMap"),    { ssr: false, loading: () => <SkeletonLoader height="h-[600px]" /> });

type MetricDataKeys = {
  [K in keyof MetricResponse]: MetricResponse[K] extends MetricWithData ? K : never;
}[keyof MetricResponse];

function useMetricGetter(metrics: MetricResponse | null) {
  return (k: MetricDataKeys): MetricWithData =>
    ((metrics?.[k] as MetricWithData) ?? { result: 0, variation: 0, isPositive: false, data: [] });
}

export function FinancialSection({ metrics }: { metrics: MetricResponse }) {
  const get = useMetricGetter(metrics);

  const formatted = useMemo(() => ({
    avgRental:       formatCurrencyFixed(metrics.averageRentalTicket?.result),
    totalRental:     formatCurrencyFixed(metrics.totalRentalActive?.result),
    totalTaxFee:     formatCurrencyRounded(metrics.totalPropertyTaxAndCondoFee?.result),
    totalAcquisition:formatCurrencyFixed(metrics.totalAcquisitionValue?.result),
    vacancyMonths:   `${Math.round(metrics.vacancyInMonths?.result ?? 0)} meses`,
  }), [metrics]);

  return (
    <>
      <NumericCard value={formatted.avgRental}        label="Ticket Médio do Aluguel"                variation={String(get("averageRentalTicket").variation)}        positive={get("averageRentalTicket").isPositive}        detailData={get("averageRentalTicket").data}        detailColumns={COLS_AVG_RENTAL} />
      <NumericCard value={formatted.totalRental}      label="Valor Total de Aluguel do Portfólio"    variation={String(get("totalRentalActive").variation)}          positive={get("totalRentalActive").isPositive}          detailData={get("totalRentalActive").data}          detailColumns={COLS_TOTAL_RENTAL} />
      <NumericCard value={formatted.totalTaxFee}      label="Total de Impostos e Taxas (Mensal Est.)"variation={String(get("totalPropertyTaxAndCondoFee").variation)} positive={get("totalPropertyTaxAndCondoFee").isPositive} detailData={get("totalPropertyTaxAndCondoFee").data} detailColumns={COLS_TAX_FEE} />
      <NumericCard value={formatted.totalAcquisition} label="Valor Total de Aquisição do Portfólio"  variation={String(get("totalAcquisitionValue").variation)}      positive={get("totalAcquisitionValue").isPositive}      detailData={get("totalAcquisitionValue").data}      detailColumns={COLS_ACQUISITION} />
      <EChartsGauge label="Índice de Vacância Financeira" value={get("financialVacancyRate").result} color="#8B5CF6" detailData={get("financialVacancyRate").data} detailColumns={COLS_FINANCIAL_VACANCY_GAUGE} />
      <NumericCard value={formatted.vacancyMonths}    label="Total da Vacância em Meses"             variation={String(get("vacancyInMonths").variation)}            positive={get("vacancyInMonths").isPositive}            detailData={get("vacancyInMonths").data}            detailColumns={COLS_VACANCY_MONTHS} />
    </>
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