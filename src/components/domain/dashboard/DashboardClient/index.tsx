/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import DashboardLayout from "@/layout/DashboardLayout";
import { fetchSection, getDefaultDateRange, FilterType, DashboardData } from "@/lib/dashboard";
import { useAuth } from "@/contexts";

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
  const searchParams = useSearchParams();
  const { token } = useAuth();

  const [filter, setFilter]   = useState<FilterType>(initialFilter);
  const [metrics, setMetrics] = useState<DashboardData>(initialMetrics);
  const [loading, setLoading] = useState<Record<FilterType, boolean>>({
    financial: false,
    portfolio: false,
    clients:   false,
    map:       false,
  });
  const [error, setError] = useState<string | null>(null);

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
      setError(null);

      try {
        const { startDate, endDate } = getDateRange();
        const data = await fetchSection(section, { startDate, endDate, token: token ?? undefined });

        setMetrics(prev => ({ ...prev, [section]: data as any }));
        fetchedRef.current.add(section);
      } catch (err: any) {
        console.error(`[Client] Erro ao carregar ${section}:`, err);
        setError(err.message ?? "Erro desconhecido");
      } finally {
        setLoading(prev => ({ ...prev, [section]: false }));
        setFilter(section);
      }
    },
    // `token` importa: sem ele na lista, um token que chega depois da montagem
    // deixaria este callback preso ao valor antigo (fetch sem Authorization).
    [getDateRange, token]
  );

  // ─── Re-fetch everything when the date range changes ─────────────────────
  useEffect(() => {
    // Invalidate cache so all sections refetch with the new dates
    fetchedRef.current.clear();
    loadSection(filter, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
      try {
        const data = await fetchSection(section, { startDate, endDate, token: token ?? undefined });
        setMetrics(prev => ({ ...prev, [section]: data as any }));
      } catch (err: any) {
        console.error(`[Client] Erro ao atualizar período de ${section}:`, err);
      }
    },
    [token]
  );

  // ─── Error / empty state ──────────────────────────────────────────────────
  if (error && !metrics[filter]) {
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