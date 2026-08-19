/* eslint-disable @typescript-eslint/no-explicit-any */
import { MetricResponse } from "@/types/types";
import { getDashboardSectionAction } from "@/server/actions/dashboard";

export type FilterType = "financial" | "portfolio" | "clients" | "map";

export interface MapCoordinate {
  lat: number;
  lng: number;
  info: string;
  /** true = locado (alfinete roxo); false = disponível (alfinete vermelho). Tarefa 2. */
  isLeased: boolean;
  status: "OCCUPIED" | "AVAILABLE";
}

export interface DashboardData {
  financial: MetricResponse | null;
  portfolio: MetricResponse | null;
  clients:   MetricResponse | null;
  map:       MapCoordinate[] | null;
  [key: string]: MetricResponse | MapCoordinate[] | null;
}

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

/**
 * Busca os dados de uma seção do dashboard via Server Action
 * (`getDashboardSectionAction`), sem `fetch`/token — a guarda e o tenant rodam
 * no servidor (withTenant). Origem: DashboardController do backend.
 */
export async function fetchSection<T = MetricResponse | MapCoordinate[]>(
  section: FilterType,
  options: {
    startDate?: string | null;
    endDate?: string | null;
    fetchOptions?: RequestInit;
    token?: string;
  } = {}
): Promise<T> {
  const defaults = getDefaultDateRange();
  const start = options.startDate ?? defaults.start;
  const end   = options.endDate   ?? defaults.end;

  const result = await getDashboardSectionAction(section, start, end);

  if (!result.ok) {
    // `status` permite o chamador distinguir "sem permissão" (403) de falhas
    // reais (500, validação) e mostrar uma mensagem amigável em vez do status cru.
    const error = new Error(result.error) as Error & { status?: number };
    error.status = result.status;
    throw error;
  }

  if (section === "map") {
    const raw: any[] = (result.data as { coordinates?: any[] })?.coordinates ?? [];
    return raw.map((g) => ({
      lat:  Number(g.lat  ?? 0),
      lng:  Number(g.lng  ?? 0),
      info: String(g.info ?? ""),
      isLeased: Boolean(g.isLeased ?? g.status === "OCCUPIED"),
      status: (g.status === "OCCUPIED" ? "OCCUPIED" : "AVAILABLE") as "OCCUPIED" | "AVAILABLE",
    })) as T;
  }

  return result.data as T;
}