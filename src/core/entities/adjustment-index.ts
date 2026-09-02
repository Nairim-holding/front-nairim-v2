/**
 * Índices de Reajuste de locação (menu Cadastrar > Índices de Reajuste).
 *
 * Os valores mensais podem vir de duas fontes: digitados na tela ou puxados
 * do SGS (Sistema Gerenciador de Séries Temporais) do Banco Central. Este
 * módulo concentra as regras puras — códigos de série, parsing da resposta do
 * BCB e normalização dos períodos —, sem I/O, para que a rotina automática e
 * o botão de atualização manual compartilhem exatamente a mesma lógica.
 *
 * Camada: core (regra pura, sem I/O).
 */

/** Indexadores suportados pela integração automática. */
export const ADJUSTMENT_INDEX_CODES = ['IGP-M', 'IPCA', 'INPC', 'IVAR'] as const;

export type AdjustmentIndexCode = (typeof ADJUSTMENT_INDEX_CODES)[number];

/**
 * Códigos das séries do SGS/BCB.
 *
 * `monthly` é a variação do mês; `accumulated12m` só existe quando o Banco
 * Central publica uma série separada para o acumulado em 12 meses (caso do
 * IPCA). Para os demais, o acumulado é calculado compondo os 12 meses.
 */
export const SGS_SERIES: Record<AdjustmentIndexCode, { monthly: number; accumulated12m?: number } | null> = {
  'IGP-M': { monthly: 189 },
  IPCA: { monthly: 433, accumulated12m: 13522 },
  INPC: { monthly: 188 },
  // O IVAR é apurado pela FGV/IBRE e o Banco Central NÃO o espelha no SGS.
  //
  // O código 28892 (que a especificação repete, citando a API do BCB) NÃO
  // EXISTE. Medido em 02/09/2026, com e sem `dataInicial/dataFinal`:
  //   28892  -> 30s de espera, HTTP 200, text/html, "Requisição inválida!"
  //   999999 -> 30s de espera, HTTP 200, text/html, "Requisição inválida!"
  //   189    -> 0,3s, HTTP 200, application/json
  //   13522  -> 0,1s, HTTP 200, application/json
  // Ou seja: 28892 responde exatamente como um código inventado. Atenção ao
  // tentar reconferir — o erro leva ~30s para voltar, então um timeout curto
  // faz parecer instabilidade de rede quando na verdade a série não existe.
  //
  // Também não é caso de "código errado, achar o certo": o catálogo de dados
  // abertos do BCB não tem nenhuma série de aluguel residencial. Buscas por
  // IVAR/aluguel/alugueis/locação só trazem "Aluguel de equipamentos" (balanço
  // de pagamentos) e o IVG-R (21340), que mede garantia de imóvel FINANCIADO.
  //
  // A série histórica da FGV é paga (FGVDados), então não há fonte automática
  // gratuita: o IVAR fica como indexador de preenchimento MANUAL — aparece no
  // ComboBox da locação e aceita valores digitados, mas é pulado pelo sync.
  IVAR: null,
};

/** Indexadores que a rotina automática consegue atualizar pelo BCB. */
export const AUTO_UPDATABLE_CODES = ADJUSTMENT_INDEX_CODES.filter((code) => SGS_SERIES[code] !== null);

/** Descrição padrão de cada indexador, usada ao semear o cadastro. */
export const ADJUSTMENT_INDEX_DESCRIPTIONS: Record<AdjustmentIndexCode, string> = {
  'IGP-M': 'Índice Geral de Preços - Mercado',
  IPCA: 'Índice Nacional de Preços ao Consumidor Amplo',
  INPC: 'Índice Nacional de Preços ao Consumidor',
  IVAR: 'Índice de Variação de Aluguéis Residenciais',
};

export const SGS_BASE_URL = 'https://api.bcb.gov.br/dados/serie';

/** Monta a URL da série, opcionalmente restrita a um intervalo de datas. */
export function buildSgsUrl(seriesCode: number, range?: { from: Date; to: Date }): string {
  const url = `${SGS_BASE_URL}/bcdata.sgs.${seriesCode}/dados?formato=json`;
  if (!range) return url;
  return `${url}&dataInicial=${formatSgsDate(range.from)}&dataFinal=${formatSgsDate(range.to)}`;
}

/** O SGS espera e devolve datas em dd/MM/yyyy. */
export function formatSgsDate(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getUTCFullYear()}`;
}

/** Um ponto cru da resposta do SGS. */
export interface SgsPoint {
  data: string;
  valor: string;
}

/** Um valor mensal já normalizado. */
export interface AdjustmentIndexPoint {
  reference_year: number;
  reference_month: number;
  /** Variação do mês, em % (ex.: 0.42 = 0,42%). */
  monthly_rate: number;
}

/**
 * Converte a resposta do SGS em pontos mensais.
 *
 * O BCB devolve `valor` como string com ponto decimal e `data` em dd/MM/yyyy
 * (sempre o dia 01 nas séries mensais). Pontos com valor não numérico são
 * descartados em vez de virarem NaN — uma série pode trazer buracos, e um NaN
 * gravado contaminaria o acumulado de 12 meses inteiro.
 */
export function parseSgsResponse(points: SgsPoint[]): AdjustmentIndexPoint[] {
  const parsed: AdjustmentIndexPoint[] = [];
  for (const point of points ?? []) {
    const [, month, year] = String(point?.data ?? '').split('/');
    const monthNumber = Number(month);
    const yearNumber = Number(year);
    // `Number('')` é 0, não NaN: sem o teste de string vazia um buraco da
    // série entraria como variação de 0% e falsearia o acumulado.
    const rawValue = String(point?.valor ?? '').trim().replace(',', '.');
    if (rawValue === '') continue;
    const value = Number(rawValue);
    if (!Number.isFinite(value)) continue;
    if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) continue;
    if (!Number.isInteger(yearNumber)) continue;
    parsed.push({ reference_year: yearNumber, reference_month: monthNumber, monthly_rate: value });
  }
  return parsed;
}

/**
 * Acumulado em 12 meses terminando no ponto informado, composto pelas
 * variações mensais: ∏(1 + i/100) − 1.
 *
 * Índices de preço compõem, não somam — somar as 12 variações erra para mais
 * (e o erro cresce com a inflação). Devolve `null` quando não há 12 meses
 * completos até o ponto, para não publicar um acumulado parcial como se fosse
 * fechado.
 */
export function accumulate12Months(
  points: AdjustmentIndexPoint[],
  reference: { reference_year: number; reference_month: number },
): number | null {
  const ordered = [...points].sort(
    (a, b) => a.reference_year - b.reference_year || a.reference_month - b.reference_month,
  );
  const endIndex = ordered.findIndex(
    (p) => p.reference_year === reference.reference_year && p.reference_month === reference.reference_month,
  );
  if (endIndex < 11) return null;

  const window = ordered.slice(endIndex - 11, endIndex + 1);
  const factor = window.reduce((acc, point) => acc * (1 + point.monthly_rate / 100), 1);
  return round4((factor - 1) * 100);
}

/** Arredonda para 4 casas — a precisão de `Decimal(10,4)` da coluna. */
export const round4 = (value: number): number => Math.round((value + Number.EPSILON) * 10000) / 10000;

/**
 * Junta a série mensal com a de acumulado, quando o BCB publica as duas.
 * Onde a série de acumulado não cobre o mês, cai para o cálculo composto.
 */
export function mergeMonthlyAndAccumulated(
  monthly: AdjustmentIndexPoint[],
  accumulated?: AdjustmentIndexPoint[],
): Array<AdjustmentIndexPoint & { accumulated_12m: number | null }> {
  return monthly.map((point) => {
    const published = accumulated?.find(
      (a) => a.reference_year === point.reference_year && a.reference_month === point.reference_month,
    );
    return {
      ...point,
      monthly_rate: round4(point.monthly_rate),
      accumulated_12m: published ? round4(published.monthly_rate) : accumulate12Months(monthly, point),
    };
  });
}

// ─── Entidades de persistência ──────────────────────────────────────────────

/** Indexador cadastrado (menu Cadastrar > Índices de Reajuste). */
export interface AdjustmentIndex {
  id: string;
  company_id: string;
  /** Sigla exibida no ComboBox da locação (ex.: "IGP-M"). */
  code: string;
  description: string;
  /** Série mensal no SGS do BCB. Nulo = só atualização manual. */
  sgs_code: number | null;
  /** Série do acumulado 12m, quando o BCB publica separado. */
  sgs_code_12m: number | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  /** Valores mensais, quando a consulta os inclui. */
  values?: AdjustmentIndexValue[];
}

/** Um valor mensal publicado do indexador. */
export interface AdjustmentIndexValue {
  id: string;
  adjustment_index_id: string;
  reference_month: number;
  reference_year: number;
  monthly_rate: number;
  accumulated_12m: number | null;
  synced_at: Date;
  /** `true` quando veio da API do BCB; `false` se foi digitado. */
  from_api: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface CreateAdjustmentIndexData {
  code: string;
  description: string;
  sgs_code?: number | null;
  sgs_code_12m?: number | null;
  is_active?: boolean;
}

export interface UpdateAdjustmentIndexData {
  code?: string;
  description?: string;
  sgs_code?: number | null;
  sgs_code_12m?: number | null;
  is_active?: boolean;
}

/** Valor mensal informado à mão na tela. */
export interface UpsertAdjustmentIndexValueData {
  adjustment_index_id: string;
  reference_month: number;
  reference_year: number;
  monthly_rate: number;
  accumulated_12m?: number | null;
  from_api?: boolean;
}

export interface ListAdjustmentIndexesParams {
  page?: number;
  limit?: number;
  search?: string;
  includeInactive?: boolean;
}

export interface PaginatedAdjustmentIndexes {
  data: AdjustmentIndex[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Resultado de uma rodada de sincronização com o BCB. */
export interface SyncResult {
  /** Indexadores efetivamente sincronizados. */
  synced: Array<{ code: string; imported: number }>;
  /** Indexadores pulados, com o motivo (ex.: IVAR sem série utilizável). */
  skipped: Array<{ code: string; reason: string }>;
}

/** Rótulo "MM/AAAA" do período de referência. */
export function formatReference(value: { reference_month: number; reference_year: number }): string {
  return `${String(value.reference_month).padStart(2, '0')}/${value.reference_year}`;
}

/** Ordena valores do mais recente para o mais antigo (ordem da tabela na tela). */
export function sortValuesDesc<T extends { reference_year: number; reference_month: number }>(values: T[]): T[] {
  return [...values].sort(
    (a, b) => b.reference_year - a.reference_year || b.reference_month - a.reference_month,
  );
}
