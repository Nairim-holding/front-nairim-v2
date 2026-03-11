/* eslint-disable @typescript-eslint/no-explicit-any */
import { MetricResponse } from "@/types/types";

export type FilterType = "financial" | "portfolio" | "clients" | "map";

export interface MapCoordinate {
  lat: number;
  lng: number;
  info: string;
}

export interface DashboardData {
  financial: MetricResponse | null;
  portfolio: MetricResponse | null;
  clients:   MetricResponse | null;
  map:       MapCoordinate[] | null;
  [key: string]: MetricResponse | MapCoordinate[] | null;
}

const ENDPOINT_MAP: Record<FilterType, string> = {
  financial: "/dashboard/financial",
  portfolio: "/dashboard/portfolio",
  clients:   "/dashboard/clients",
  map:       "/dashboard/map",
};

function getDefaultDateRange(): { start: string; end: string } {
  const today    = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay  = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return { start: fmt(firstDay), end: fmt(lastDay) };
}

export async function fetchSection<T = MetricResponse | MapCoordinate[]>(
  section: FilterType,
  options: {
    startDate?: string | null;
    endDate?: string | null;
    fetchOptions?: RequestInit;
  } = {}
): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_URL_API;
  if (!baseUrl) throw new Error("NEXT_PUBLIC_URL_API não configurada");

  const defaults = getDefaultDateRange();
  const start = options.startDate ?? defaults.start;
  const end   = options.endDate   ?? defaults.end;

  const url = `${baseUrl}${ENDPOINT_MAP[section]}?startDate=${start}&endDate=${end}`;

  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
    },
    ...options.fetchOptions,
  });

  if (!res.ok) throw new Error(`Erro ao carregar ${section}: ${res.status}`);

  const json = await res.json();
  if (!json.success) throw new Error(json.message ?? `Erro na resposta da API (${section})`);

  if (section === "map") {
    const raw: any[] = json.data?.coordinates ?? (Array.isArray(json.data) ? json.data : []);
    return raw.map((g) => ({
      lat:  Number(g.lat  ?? 0),
      lng:  Number(g.lng  ?? 0),
      info: String(g.info ?? ""),
    })) as T;
  }

  return json.data as T;
}