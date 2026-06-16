import type { Metadata } from 'next';
import { Suspense } from "react";
import { cookies } from "next/headers";

export const metadata: Metadata = { title: 'Dashboard' };
import { fetchSection, FilterType, DashboardData } from "@/lib/dashboard";
import DashboardContent from "@/components/domain/dashboard/DashboardClient";

interface PageProps {
  searchParams: Promise<{ startDate?: string; endDate?: string }>;
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const { startDate, endDate } = params;

  const cookieStore = await cookies();
  const token = cookieStore.get("authToken")?.value;

  let initialFinancial: DashboardData["financial"] = null;

  try {
    initialFinancial = await fetchSection("financial", { startDate, endDate, token });
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
