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

/** Mês corrente — o mesmo default do filtro de período das abas (Tarefa 5.3/6.1,
 * 29/07/26). Precisa ficar em sincronia com o default de useSectionPeriod: os
 * dois alimentam o mesmo primeiro carregamento (fetch inicial aqui, cabeçalho
 * lá), e já tivemos um bug de um dizer "Ano inteiro" enquanto o outro trazia
 * só o mês. */
export function getDefaultDateRange(): { start: string; end: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return { start: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), end: fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
}

export async function fetchSection<T = MetricResponse | MapCoordinate[]>(
  section: FilterType,
  options: {
    startDate?: string | null;
    endDate?: string | null;
    fetchOptions?: RequestInit;
    token?: string;
  } = {}
): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_URL_API;
  if (!baseUrl) throw new Error("NEXT_PUBLIC_URL_API não configurada");

  const defaults = getDefaultDateRange();
  const start = options.startDate ?? defaults.start;
  const end   = options.endDate   ?? defaults.end;

  const url = `${baseUrl}${ENDPOINT_MAP[section]}?startDate=${start}&endDate=${end}`;

  const authHeaders: Record<string, string> = {};
  if (options.token) {
    authHeaders["Authorization"] = `Bearer ${options.token}`;
  }

  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      ...authHeaders,
    },
    ...options.fetchOptions,
  });

  if (!res.ok) {
    // `status` permite o chamador distinguir "sem permissão" (403) de falhas
    // reais (500, rede) e mostrar uma mensagem amigável em vez do status cru.
    const error = new Error(`Erro ao carregar ${section}: ${res.status}`) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }

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