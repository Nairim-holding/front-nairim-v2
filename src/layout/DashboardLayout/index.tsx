/* eslint-disable @typescript-eslint/no-explicit-any */
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
}: Pick<DashboardLayoutProps, "filter" | "metrics">) {
  if (filter === "map") {
    return <MapSection data={(metrics.map as MapCoordinate[]) ?? []} />;
  }

  const current = metrics[filter] as MetricResponse | null;
  if (!current) return null;

  switch (filter) {
    case "financial": return <FinancialSection metrics={current} />;
    case "portfolio": return <PortfolioSection metrics={current} />;
    case "clients":   return <ClientsSection   metrics={current} />;
    default:          return null;
  }
}

function DashboardLayout({ filter, metrics, isLoading, onFilterChange }: DashboardLayoutProps) {
  return (
    <section className="p-3 min-h-screen transition-all duration-300">
      <DashboardFilter filter={filter} setFilter={onFilterChange} />

      <div className="flex flex-wrap gap-4 transition-all duration-300">
        {isLoading ? (
          <LoadingSkeleton filter={filter} />
        ) : (
          <ActiveSection filter={filter} metrics={metrics} />
        )}
      </div>
    </section>
  );
}

export default memo(DashboardLayout);