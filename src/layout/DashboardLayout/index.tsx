/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useMemo } from "react";
import dynamic from "next/dynamic";
import { MetricResponse, MetricWithData } from "@/types/types"; 
import DashboardFilter from "@/components/DashboardFilter";
import NumericCard from "@/components/NumericCard";

const SkeletonLoader = ({ height = "h-[240px]" }: { height?: string }) => (
  <div
    className={`bg-surface rounded-lg p-4 border border-ui-border-strong shadow-chart w-full cursor-pointer transition-all duration-300 flex flex-col justify-between animate-pulse ${height}`}
  >
    <div className="flex flex-col gap-3 flex-1">
      <div className="h-5 w-2/5 bg-surface-subtle rounded-md"></div>
      <div className="h-4 w-1/3 bg-surface-subtle rounded-md"></div>
      <div className="flex-1 bg-surface-subtle rounded-md mt-3"></div>
    </div>
  </div>
);

const EChartsDonut = dynamic(() => import("@/components/EChartsDonut"), { ssr: false, loading: () => <SkeletonLoader /> });
const EChartsGauge = dynamic(() => import("@/components/EChartsGauge"), { ssr: false, loading: () => <SkeletonLoader /> });
const EChartsBar = dynamic(() => import("@/components/EChartsBar"), { ssr: false, loading: () => <SkeletonLoader /> });

// ATENÇÃO: Mudamos para o novo componente LeafletMap
const LeafletMap = dynamic(() => import("@/components/LeafletMap"), { 
  ssr: false, 
  loading: () => <SkeletonLoader height="h-[600px]" /> 
});

interface DashboardProps {
  filter: "financial" | "portfolio" | "clients" | "map";
  metrics: Record<string, MetricResponse | any[] | null>;
  isLoading: boolean;
  onFilterChange: (filter: "financial" | "portfolio" | "clients" | "map") => void;
}

type MetricDataKeys = { [K in keyof MetricResponse]: MetricResponse[K] extends MetricWithData ? K : never }[keyof MetricResponse];

export default function DashboardLayout({ filter, metrics, isLoading, onFilterChange }: DashboardProps) {
  const currentMetrics = metrics[filter] as MetricResponse | null;

  const formatted = useMemo(() => {
    if (!currentMetrics) return {};
    const fmtCurrency = (v?: number) => typeof v === "number" ? `R$ ${v.toFixed(2).replace(".", ",")}` : "R$ 0,00";
    return {
      avgRental: fmtCurrency(currentMetrics.averageRentalTicket?.result),
      totalRentalActive: fmtCurrency(currentMetrics.totalRentalActive?.result),
      totalTaxFee: typeof currentMetrics.totalPropertyTaxAndCondoFee?.result === "number" ? `R$ ${Math.round(currentMetrics.totalPropertyTaxAndCondoFee.result).toString().replace(".", ",")}` : "R$ 0",
      totalAcquisition: fmtCurrency(currentMetrics.totalAcquisitionValue?.result),
      vacancyMonths: `${Math.round(currentMetrics.vacancyInMonths?.result ?? 0)} meses`,
    };
  }, [currentMetrics]);

  const formatCurrency = (val: any) => typeof val === 'number' ? `R$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "R$ 0,00";
  const statusMap: Record<string, string> = { 'AVAILABLE': 'Disponível', 'RENTED': 'Alugado', 'OCCUPIED': 'Ocupado', 'SOLD': 'Vendido', 'MAINTENANCE': 'Manutenção', 'UNAVAILABLE': 'Indisponível' };
  const formatStatus = (v: string) => statusMap[v] || v || "-";
  const formatValueOrDash = (v: any) => (v !== undefined && v !== null) ? v : "-";
  const formatPropertyList = (properties: any[]) => {
    if (!properties || !Array.isArray(properties) || properties.length === 0) return "-";
    const displayProps = properties.slice(0, 3).map(p => p.title).join(", ");
    return properties.length > 3 ? `${displayProps} (+${properties.length - 3})` : displayProps;
  };

  const renderSection = () => {
    if (isLoading) {
      return filter === 'map' ? <SkeletonLoader height="h-[600px]" /> : Array.from({ length: 6 }).map((_, i) => <SkeletonLoader key={i} />);
    }

    if (filter === "map") {
      const mapData = (metrics["map"] as any[]) || [];
      return (
        <div className="w-full transition-all duration-300">
          <LeafletMap data={mapData} />
        </div>
      );
    }

    if (!currentMetrics) return null;
    const get = (k: MetricDataKeys): MetricWithData => (currentMetrics[k] as MetricWithData) ?? { result: 0, variation: 0, isPositive: false, data: [] };

    switch (filter) {
      case "financial":
        return (
          <>
            <NumericCard value={formatted.avgRental || "R$ 0,00"} label="Ticket Médio do Aluguel" variation={String(get("averageRentalTicket").variation)} positive={get("averageRentalTicket").isPositive} detailData={get("averageRentalTicket").data} detailColumns={[{ key: "title", label: "Imóvel", width: "250px" }, { key: "type", label: "Tipo", width: "120px" }, { key: "rentalValue", label: "Valor do Aluguel", format: formatCurrency, width: "150px" }, { key: "valuePerSqm", label: "Valor/m²", format: (v: any) => `R$ ${v?.toFixed(2)}`, width: "100px" }, { key: "areaTotal", label: "Área Total", format: (v: any) => `${formatValueOrDash(v)}m²`, width: "100px" }, { key: "owner", label: "Proprietário", width: "150px" }]} />
            <NumericCard value={formatted.totalRentalActive || "R$ 0,00"} label="Valor Total de Aluguel do Portfólio" variation={String(get("totalRentalActive").variation)} positive={get("totalRentalActive").isPositive} detailData={get("totalRentalActive").data} detailColumns={[{ key: "title", label: "Imóvel", width: "250px" }, { key: "type", label: "Tipo", width: "120px" }, { key: "status", label: "Status", width: "100px", format: formatStatus }, { key: "rentalValue", label: "Valor do Aluguel", format: formatCurrency, width: "150px" }, { key: "agency", label: "Imobiliária", width: "200px", format: (value: any) => value?.tradeName || "-" }, { key: "leaseInfo", label: "Contrato Ativo", width: "300px", format: (value: any) => value ? `Contrato: ${value.contractNumber || 'N/A'} | Inquilino: ${value.tenantName || 'N/A'}` : "Sem contrato ativo" }]} />
            <NumericCard value={formatted.totalTaxFee || "R$ 0"} label="Total de Impostos e Taxas (Mensal Est.)" variation={String(get("totalPropertyTaxAndCondoFee").variation)} positive={get("totalPropertyTaxAndCondoFee").isPositive} detailData={get("totalPropertyTaxAndCondoFee").data} detailColumns={[{ key: "title", label: "Imóvel", width: "250px" }, { key: "type", label: "Tipo", width: "120px" }, { key: "propertyTax", label: "IPTU", format: formatCurrency, width: "120px" }, { key: "condoFee", label: "Condomínio", format: formatCurrency, width: "120px" }, { key: "totalTaxAndCondo", label: "Total", format: formatCurrency, width: "120px" }, { key: "rentalValue", label: "Valor Aluguel", format: formatCurrency, width: "150px" }, { key: "costToRentRatio", label: "Custo/Aluguel (%)", format: (value: number) => `${value?.toFixed(2) || "0"}%`, width: "120px" }, { key: "impactOnRevenue", label: "Impacto Receita (%)", format: (value: any) => `${value?.toFixed(2) || "0"}%`, width: "120px" }]} />
            <NumericCard value={formatted.totalAcquisition || "R$ 0,00"} label="Valor Total de Aquisição do Portfólio" variation={String(get("totalAcquisitionValue").variation)} positive={get("totalAcquisitionValue").isPositive} detailData={get("totalAcquisitionValue").data} detailColumns={[{ key: "title", label: "Imóvel", width: "250px" }, { key: "type", label: "Tipo", width: "120px" }, { key: "purchaseValue", label: "Valor de Aquisição", format: formatCurrency, width: "150px" }, { key: "currentStatus", label: "Status", width: "100px", format: formatStatus }, { key: "acquisitionDate", label: "Data Aquisição", format: (value: any) => value ? new Date(value).toLocaleDateString("pt-BR") : "N/A", width: "120px" }, { key: "saleValue", label: "Valor de Venda", format: (value: number) => value ? `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "Não definido", width: "150px" }, { key: "estimatedAnnualROI", label: "ROI Anual Est. (%)", format: (v: any) => `${v?.toFixed(2)}%`, width: "120px" }]} />
            <EChartsGauge label="Índice de Vacância Financeira" value={get("financialVacancyRate").result} color="#8B5CF6" detailData={get("financialVacancyRate").data} detailColumns={[{ key: "title", label: "Imóvel" }, { key: "type", label: "Tipo" }, { key: "rentalValue", label: "Valor do Aluguel", format: formatCurrency }, { key: "areaTotal", label: "Área Total (m²)", format: (value: any) => `${formatValueOrDash(value)}` }, { key: "monthsVacant", label: "Meses de Vacância", format: (value: any) => `${formatValueOrDash(value)} meses` }, { key: "lastLeaseInfo", label: "Último Inquilino", format: (v: any) => v ? `${v.tenantName} (Fim: ${new Date(v.endDate).toLocaleDateString("pt-BR")})` : "N/A" }, { key: "estimatedLoss", label: "Perda Estimada", format: formatCurrency }]} />
            <NumericCard value={formatted.vacancyMonths || "0 meses"} label="Total da Vacância em Meses" variation={String(get("vacancyInMonths").variation)} positive={get("vacancyInMonths").isPositive} detailData={get("vacancyInMonths").data} detailColumns={[{ key: "title", label: "Imóvel", width: "250px" }, { key: "type", label: "Tipo", width: "120px" }, { key: "rentalValue", label: "Valor do Aluguel", format: formatCurrency, width: "150px" }, { key: "areaTotal", label: "Área Total (m²)", format: (value: number) => `${formatValueOrDash(value)}`, width: "120px" }, { key: "vacancyMonths", label: "Meses Vacância", format: (value: number) => `${value || "0"} meses`, width: "120px" }, { key: "lastLeaseEndDate", label: "Último Contrato", format: (value: any) => value ? new Date(value).toLocaleDateString("pt-BR") : "Sem contrato anterior", width: "150px" }, { key: "estimatedLoss", label: "Perda Estimada", format: formatCurrency, width: "150px" }]} />
          </>
        );

      case "portfolio":
        const vacancyData = (get("vacancyRate").data || []).map((item: any) => ({ ...item, status: 'AVAILABLE', areaTotal: item.areaTotal ?? 0 }));
        const occupationData = (get("occupationRate").data || []).map((item: any) => ({ ...item, status: item.status || 'OCCUPIED', areaTotal: item.areaTotal }));
        const typesData = ((currentMetrics.availablePropertiesByType as any[]) ?? []).map(group => ({ ...group, data: group.data?.map((item: any) => ({ ...item, areaTotal: item.areaTotal, monthsVacant: item.monthsVacant })) }));

        return (
          <>
            <NumericCard value={String(get("totalPropertys").result)} label="Total de Imóveis" variation={String(get("totalPropertys").variation)} positive={get("totalPropertys").isPositive} detailData={get("totalPropertys").data} detailColumns={[{ key: "id", label: "ID" }, { key: "title", label: "Título" }, { key: "type", label: "Tipo" }, { key: "status", label: "Status", format: formatStatus }, { key: "rentalValue", label: "Aluguel", format: formatCurrency }, { key: "areaTotal", label: "Área", format: (v: any) => `${formatValueOrDash(v)}m²` }, { key: "documentCount", label: "Qtd. Docs" }, { key: "agency", label: "Agência", format: (v: any) => v?.tradeName || "-" }]} />
            <NumericCard value={String(get("countPropertiesWithLessThan3Docs").result)} label="Imóveis com Documentação Pendente" variation={String(get("countPropertiesWithLessThan3Docs").variation)} positive={get("countPropertiesWithLessThan3Docs").isPositive} detailData={get("countPropertiesWithLessThan3Docs").data} detailColumns={[{ key: "title", label: "Imóvel", width: "250px" }, { key: "documentCount", label: "Qtd. Atual", width: "100px" }, { key: "type", label: "Tipo", width: "120px" }, { key: "missingDocuments", label: "Documentos Faltantes", width: "300px", format: (docs: string[]) => docs.map(d => ({TITLE_DEED: 'Escritura', REGISTRATION: 'Matrícula', PROPERTY_RECORD: 'Registro'}[d] || d)).join(', ') }, { key: "isComplete", label: "Completo", format: (v: boolean) => v ? "Sim" : "Não" }]} />
            <NumericCard value={String(get("totalPropertiesWithSaleValue").result)} label="Imóveis com Valor de Venda Definido" variation={String(get("totalPropertiesWithSaleValue").variation)} positive={get("totalPropertiesWithSaleValue").isPositive} detailData={get("totalPropertiesWithSaleValue").data} detailColumns={[{ key: "id", label: "ID" }, { key: "title", label: "Título" }, { key: "saleValue", label: "Valor Venda", format: formatCurrency }, { key: "type", label: "Tipo" }, { key: "rentalValue", label: "Aluguel", format: formatCurrency }]} />
            <EChartsDonut data={[{ name: "Disponíveis", value: get("vacancyRate").result, data: vacancyData }, { name: "Ocupados", value: get("occupationRate").result, data: occupationData }]} label="Imóveis por Status de Disponibilidade" detailColumns={[{ key: "title", label: "Imóvel" }, { key: "type", label: "Tipo" }, { key: "rentalValue", label: "Valor Aluguel", format: formatCurrency }, { key: "areaTotal", label: "Área (m²)", format: (v: any) => formatValueOrDash(v) }, { key: "status", label: "Status", format: formatStatus }]} />
            <EChartsDonut data={typesData} label="Imóveis na Carteira" colors={['#FF7777', '#77FF7B', '#F9FF53', '#77A2FF', '#E477FF']} detailColumns={[{ key: "title", label: "Imóvel" }, { key: "type", label: "Tipo" }, { key: "rentalValue", label: "Valor Aluguel", format: formatCurrency }, { key: "areaTotal", label: "Área (m²)", format: (v: any) => formatValueOrDash(v) }, { key: "monthsVacant", label: "Meses Vago", format: (v: any) => formatValueOrDash(v) }]} />
            <EChartsGauge label="Taxa de Ocupação" value={get("occupationRate").result} color="#10B981" detailData={get("occupationRate").data} detailColumns={[{ key: "id", label: "ID" }, { key: "title", label: "Imóvel" }, { key: "rentalValue", label: "Valor Aluguel", format: formatCurrency }, { key: "status", label: "Status", format: formatStatus }, { key: "type", label: "Tipo" }]} />
            <EChartsGauge label="Taxa de Vacância Física" value={get("vacancyRate").result} color="#EF4444" detailData={get("vacancyRate").data} detailColumns={[{ key: "id", label: "ID" }, { key: "title", label: "Imóvel" }, { key: "rentalValue", label: "Valor Aluguel", format: formatCurrency }, { key: "type", label: "Tipo" }, { key: "areaTotal", label: "Area Total (m²)", format: (value: number) => `${formatValueOrDash(value)}` }]} />
          </>
        );

      case "clients":
        return (
          <>
            <NumericCard value={String(get("ownersTotal").result)} label="Total de Proprietários" variation={String(get("ownersTotal").variation)} positive={get("ownersTotal").isPositive} detailData={get("ownersTotal").data} detailColumns={[{ key: "name", label: "Nome", width: "200px" }, { key: "createdAt", label: "Desde", format: (v: any) => new Date(v).toLocaleDateString("pt-BR"), width: "120px" }, { key: "propertiesCount", label: "Qtd. Imóveis", width: "100px" }, { key: "properties", label: "Imóveis", format: formatPropertyList, width: "300px" }]} />
            <NumericCard value={String(get("tenantsTotal").result)} label="Total de Inquilinos" variation={String(get("tenantsTotal").variation)} positive={get("tenantsTotal").isPositive} detailData={get("tenantsTotal").data} detailColumns={[{ key: "name", label: "Nome", width: "200px" }, { key: "createdAt", label: "Desde", format: (v: any) => new Date(v).toLocaleDateString("pt-BR"), width: "120px" }, { key: "properties", label: "Imóveis Locados", format: formatPropertyList, width: "300px" }]} />
            <NumericCard value={get("propertiesPerOwner").result?.toFixed(2) || "0"} label="Média de Imóveis por Proprietário" variation={String(get("propertiesPerOwner").variation)} positive={get("propertiesPerOwner").isPositive} detailData={get("propertiesPerOwner").data} detailColumns={[{ key: "name", label: "Proprietário", width: "200px" }, { key: "propertiesCount", label: "Qtd. Imóveis", width: "100px" }, { key: "properties", label: "Imóveis", format: formatPropertyList, width: "300px" }]} />
            <NumericCard value={String(get("agenciesTotal").result)} label="Total de Imobiliárias" variation={String(get("agenciesTotal").variation)} positive={get("agenciesTotal").isPositive} detailData={get("agenciesTotal").data} detailColumns={[{ key: "tradeName", label: "Nome Fantasia" }, { key: "legalName", label: "Razão Social" }, { key: "createdAt", label: "Desde", format: (v: any) => new Date(v).toLocaleDateString("pt-BR") }, { key: "propertiesCount", label: "Qtd. Imóveis" }]} />
            <EChartsBar data={currentMetrics.propertiesByAgency ?? []} label="Imóveis por Imobiliárias" detailColumns={[{ key: "title", label: "Imóvel" }, { key: "rentalValue", label: "Valor", format: formatCurrency }, { key: "status", label: "Status", format: formatStatus }, { key: "agency", label: "Imobiliária", format: (v:any) => v?.tradeName || v?.legalName || "-" }]} />
          </>
        );

      default:
        return null;
    }
  };

  return (
    <section className="p-3 min-h-screen transition-all duration-300">
      <DashboardFilter filter={filter} setFilter={onFilterChange} />
      <div className="flex flex-wrap gap-4 transition-all duration-300">
        {renderSection()}
      </div>
    </section>
  );
}
