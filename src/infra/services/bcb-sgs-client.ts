import {
  buildSgsUrl,
  mergeMonthlyAndAccumulated,
  parseSgsResponse,
  SGS_SERIES,
  type AdjustmentIndexCode,
  type AdjustmentIndexPoint,
  type SgsPoint,
} from '@/core/entities/adjustment-index';

/**
 * Cliente do SGS (Sistema Gerenciador de Séries Temporais) do Banco Central.
 *
 * A API é pública e sem autenticação, mas é instável em horário de pico e
 * responde HTML de erro com status 200 em alguns casos — por isso a resposta é
 * validada antes de virar dado, e qualquer falha vira `SgsUnavailableError`
 * para a tela poder dizer "índice não atualizado" em vez de quebrar.
 *
 * Camada: infra.
 */

/** Falha ao consultar o BCB — rede, timeout, status ruim ou payload inesperado. */
export class SgsUnavailableError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'SgsUnavailableError';
  }
}

/** Timeout por requisição. O SGS costuma responder em <1s; 15s é folga. */
const REQUEST_TIMEOUT_MS = 15_000;

async function fetchSeries(seriesCode: number, range?: { from: Date; to: Date }): Promise<AdjustmentIndexPoint[]> {
  const url = buildSgsUrl(seriesCode, range);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      // A série muda no máximo uma vez por mês; não faz sentido revalidar a
      // cada chamada, e o cache protege o BCB de rajadas nossas.
      next: { revalidate: 60 * 60 * 6 },
    });

    if (!response.ok) {
      throw new SgsUnavailableError(`O Banco Central respondeu ${response.status} para a série ${seriesCode}.`);
    }

    // Em erro o SGS às vezes devolve HTML com status 200 — sem esta checagem,
    // o `json()` estoura com um erro de parse que não explica nada.
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('json')) {
      throw new SgsUnavailableError(`O Banco Central respondeu em formato inesperado para a série ${seriesCode}.`);
    }

    const payload: unknown = await response.json();

    // O SGS responde `{"erro":{}}` (JSON válido, status 200) quando a série
    // não tem dado no intervalo pedido — por exemplo, uma janela que avança
    // além do último mês publicado. Isso é "sem dados", não falha da API:
    // devolvemos lista vazia para o chamador reportar direito.
    if (payload && typeof payload === 'object' && !Array.isArray(payload) && 'erro' in payload) {
      return [];
    }

    if (!Array.isArray(payload)) {
      throw new SgsUnavailableError(`A série ${seriesCode} veio em formato inesperado.`);
    }

    return parseSgsResponse(payload as SgsPoint[]);
  } catch (error) {
    if (error instanceof SgsUnavailableError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new SgsUnavailableError(`Tempo esgotado ao consultar a série ${seriesCode} no Banco Central.`, error);
    }
    throw new SgsUnavailableError(`Não foi possível consultar a série ${seriesCode} no Banco Central.`, error);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Busca a série de um indexador já com o acumulado em 12 meses resolvido.
 * Quando o BCB publica série própria de acumulado (IPCA), ela é usada; caso
 * contrário o acumulado é composto a partir das variações mensais.
 */
export async function fetchAdjustmentIndexSeries(
  code: AdjustmentIndexCode,
  range?: { from: Date; to: Date },
): Promise<Array<AdjustmentIndexPoint & { accumulated_12m: number | null }>> {
  const series = SGS_SERIES[code];
  // IVAR não tem série utilizável no SGS hoje (ver SGS_SERIES): é atualizado
  // só manualmente, então a rotina automática pula em vez de falhar.
  if (!series) throw new SgsUnavailableError(`O indexador ${code} não é atualizado automaticamente pelo Banco Central.`);

  const monthly = await fetchSeries(series.monthly, range);

  let accumulated: AdjustmentIndexPoint[] | undefined;
  if (series.accumulated12m) {
    try {
      accumulated = await fetchSeries(series.accumulated12m, range);
    } catch {
      // O acumulado é complementar: se só ele falhar, seguimos com o cálculo
      // composto em vez de perder também a série mensal, que já veio.
      accumulated = undefined;
    }
  }

  return mergeMonthlyAndAccumulated(monthly, accumulated);
}
