/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import DashboardLayout from "@/layout/DashboardLayout";
import { fetchSection, getDefaultDateRange, FilterType, DashboardData } from "@/lib/dashboard";
import ForbiddenNotice from "@/components/layout/PermissionGate/ForbiddenNotice";
import { ReportingCompaniesProvider, useReportingCompanies } from '@/components/reports/ReportingCompanies';

interface DashboardContentProps {
  /** Pre-fetched data from the Server Component (financial is populated, rest are null) */
  initialMetrics: DashboardData;
  initialFilter: FilterType;
}

/**
 * Client Component responsible for:
 * - Reactive filter switching
 * - Lazy-fetching non-initial sections on demand
 * - Syncing date range from URL search params
 */
export default function DashboardContent({ initialMetrics, initialFilter }: DashboardContentProps) {
  return <ReportingCompaniesProvider>
    <DashboardContentBody initialMetrics={initialMetrics} initialFilter={initialFilter} /></ReportingCompaniesProvider>;
}

function DashboardContentBody({ initialMetrics, initialFilter }: DashboardContentProps) {
  const { companyIds } = useReportingCompanies();
  const scopeKey = JSON.stringify(companyIds);
  const requestVersion = useRef(0);
  const sectionRanges = useRef<Partial<Record<FilterType, { startDate: string; endDate: string }>>>({});
  const sectionVersions = useRef<Partial<Record<FilterType, number>>>({});
  const searchParams = useSearchParams();

  const [filter, setFilter]   = useState<FilterType>(initialFilter);
  const [metrics, setMetrics] = useState<DashboardData>(initialMetrics);
  const [loading, setLoading] = useState<Record<FilterType, boolean>>({
    financial: false,
    portfolio: false,
    clients:   false,
    map:       false,
  });
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  // Track which sections have already been fetched to avoid redundant calls
  const fetchedRef = useRef<Set<FilterType>>(
    initialMetrics.financial ? new Set<FilterType>(["financial"]) : new Set<FilterType>()
  );

  // ─── Date range from URL ──────────────────────────────────────────────────
  const getDateRange = useCallback(() => {
    const startDate = searchParams.get("startDate");
    const endDate   = searchParams.get("endDate");
    const defaults  = getDefaultDateRange();

    return {
      startDate: startDate ?? defaults.start,
      endDate:   endDate   ?? defaults.end,
    };
  }, [searchParams]);

  // ─── Core fetch helper ────────────────────────────────────────────────────
  const loadSection = useCallback(
    async (section: FilterType, force = false) => {
      // Skip if already cached (unless forced by date-range change)
      if (!force && fetchedRef.current.has(section)) {
        setFilter(section);
        return;
      }

      setLoading(prev => ({ ...prev, [section]: true }));
      setFilter(section);
      setError(null);
      setErrorStatus(null);
      const version = requestVersion.current;
      const sectionVersion = sectionVersions.current[section] = (sectionVersions.current[section] ?? 0) + 1;
      const isCurrent = () => version === requestVersion.current && sectionVersion === sectionVersions.current[section];
      try {
        const { startDate, endDate } = sectionRanges.current[section] ?? getDateRange();
        const data = await fetchSection(section, { startDate, endDate, companyIds });
        if (!isCurrent()) return;

        setMetrics(prev => ({ ...prev, [section]: data as any }));
        fetchedRef.current.add(section);
      } catch (err: any) {
        if (!isCurrent()) return;
        console.error(`[Client] Erro ao carregar ${section}:`, err);
        setError(err.message ?? "Erro desconhecido");
        setErrorStatus(err.status ?? null);
      } finally {
        if (isCurrent()) setLoading(prev => ({ ...prev, [section]: false }));
      }
    },
    [getDateRange, companyIds]
  );

  // ─── Re-fetch everything when the date range changes ─────────────────────
  useEffect(() => {
    // Invalidate cache so all sections refetch with the new dates
    fetchedRef.current.clear();
    requestVersion.current += 1;
    setLoading({ financial: false, portfolio: false, clients: false, map: false });
    loadSection(filter, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, scopeKey]);

  // ─── Filter change handler ────────────────────────────────────────────────
  const handleFilterChange = useCallback(
    (newFilter: FilterType) => {
      loadSection(newFilter);
    },
    [loadSection]
  );

  // ─── Per-tab period filter ────────────────────────────────────────────────
  // Refetches only the given section client-side for the chosen range. Every tab
  // owns its own period filter, so every tab routes through here.
  // Deliberately avoids router.push: that re-renders the Server Component page
  // (which awaits fetchSection), which re-triggers the page-level Suspense
  // fallback and remounts this whole subtree — wiping out the section header's
  // local year/month state right after the user picks it.
  const handleSectionRangeChange = useCallback(
    async (section: FilterType, startDate: string, endDate: string) => {
      sectionRanges.current[section] = { startDate, endDate };
      const sectionVersion = sectionVersions.current[section] = (sectionVersions.current[section] ?? 0) + 1;
      const version = requestVersion.current;
      try {
        const data = await fetchSection(section, { startDate, endDate, companyIds });
        if (version !== requestVersion.current || sectionVersion !== sectionVersions.current[section]) return;
        setMetrics(prev => ({ ...prev, [section]: data as any }));
        setLoading(prev => ({ ...prev, [section]: false }));
      } catch (err: any) {
        if (version !== requestVersion.current || sectionVersion !== sectionVersions.current[section]) return;
        console.error(`[Client] Erro ao atualizar período de ${section}:`, err);
        setError(err.message ?? 'Erro ao atualizar o período.');
        setErrorStatus(err.status ?? null);
      } finally {
        if (version === requestVersion.current && sectionVersion === sectionVersions.current[section]) setLoading(prev => ({ ...prev, [section]: false }));
      }
    },
    [companyIds]
  );

  // ─── Error / empty state ──────────────────────────────────────────────────
  if (error) {
    // 403 = sem permissão no grupo — mensagem amigável, sem botão de retry
    // (tentar de novo não muda o resultado; quem resolve é um admin ajustando
    // as diretivas de acesso do grupo).
    if (errorStatus === 403) {
      return (
        <div className="flex flex-col justify-center items-center min-h-screen">
          <ForbiddenNotice />
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-4 justify-center items-center min-h-screen text-red-600">
        <p>{error}</p>
        <button
          onClick={() => loadSection(filter, true)}
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <DashboardLayout
      filter={filter}
      onFilterChange={handleFilterChange}
      metrics={metrics}
      isLoading={loading[filter]}
      onSectionRangeChange={handleSectionRangeChange}
    />
  );
}
