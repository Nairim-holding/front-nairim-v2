import type { Metadata } from 'next';
import { Suspense } from "react";
import { FilterType, DashboardData, getDefaultDateRange } from "@/lib/dashboard";
import { getDashboardSectionData } from "@/server/queries/dashboard";
import DashboardContent from "@/components/domain/dashboard/DashboardClient";

export const metadata: Metadata = { title: 'Dashboard' };

interface PageProps {
  searchParams: Promise<{ startDate?: string; endDate?: string }>;
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const defaults = getDefaultDateRange();
  const startDate = params.startDate ?? defaults.start;
  const endDate   = params.endDate   ?? defaults.end;

  let initialFinancial: DashboardData["financial"] = null;

  try {
    initialFinancial =
      (await getDashboardSectionData("financial", { startDate, endDate })) as DashboardData["financial"];
  } catch (err) {
    console.error("[SSR] Erro ao pré-carregar financial:", err);
  }

  const initialMetrics: DashboardData = {
    financial: initialFinancial,
    portfolio: null,
    clients:   null,
    map:       null,
  };

  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
        </div>
      }
    >
      <DashboardContent
        initialMetrics={initialMetrics}
        initialFilter={"financial" satisfies FilterType}
      />
    </Suspense>
  );
}