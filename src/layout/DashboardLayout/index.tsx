"use client";

import React, { memo } from "react";
import { MetricResponse } from "@/types/types";
import { MapCoordinate } from "@/lib/dashboard";
import DashboardFilter from "@/components/filters/DashboardFilter";
import {
  SkeletonLoader,
  FinancialSection,
  PortfolioSection,
  ClientsSection,
  MapSection,
} from "./sections";

type FilterType = "financial" | "portfolio" | "clients" | "map";

interface DashboardLayoutProps {
  filter: FilterType;
  metrics: Record<string, MetricResponse | MapCoordinate[] | null>;
  isLoading: boolean;
  onFilterChange: (filter: FilterType) => void;
  /** Rebusca só a seção informada com o período escolhido no filtro dela. */
  onSectionRangeChange: (section: FilterType, startDate: string, endDate: string) => void;
}

function LoadingSkeleton({ filter }: { filter: FilterType }) {
  if (filter === "map") return <SkeletonLoader height="h-[600px]" />;
  return (
    <>
      {Array.from({ length: 6 }, (_, i) => (
        <SkeletonLoader key={i} />
      ))}
    </>
  );
}

function ActiveSection({
  filter,
  metrics,
  onSectionRangeChange,
}: Pick<DashboardLayoutProps, "filter" | "metrics" | "onSectionRangeChange">) {
  // Cada seção é dona do seu filtro de período e avisa aqui para rebuscar só
  // a si mesma — por isso o range change é amarrado à seção ativa.
  const handleRangeChange = (startDate: string, endDate: string) =>
    onSectionRangeChange(filter, startDate, endDate);

  if (filter === "map") {
    // Sem filtro de período aqui (Tarefa 2) — o mapa não escuta range change.
    return <MapSection data={(metrics.map as MapCoordinate[]) ?? []} />;
  }

  const current = metrics[filter] as MetricResponse | null;
  if (!current) return null;

  switch (filter) {
    case "financial": return <FinancialSection metrics={current} onRangeChange={handleRangeChange} />;
    case "portfolio": return <PortfolioSection metrics={current} onRangeChange={handleRangeChange} />;
    case "clients":   return <ClientsSection   metrics={current} onRangeChange={handleRangeChange} />;
    default:          return null;
  }
}

function DashboardLayout({ filter, metrics, isLoading, onFilterChange, onSectionRangeChange }: DashboardLayoutProps) {
  return (
    <section className="p-3 min-h-screen transition-all duration-300">
      <DashboardFilter filter={filter} setFilter={onFilterChange} />

      <div className="flex flex-wrap gap-4 transition-all duration-300">
        {isLoading ? (
          <LoadingSkeleton filter={filter} />
        ) : (
          <ActiveSection filter={filter} metrics={metrics} onSectionRangeChange={onSectionRangeChange} />
        )}
      </div>
    </section>
  );
}

export default memo(DashboardLayout);