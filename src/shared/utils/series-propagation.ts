/**
 * Propagacao de alteracoes para os lancamentos SEGUINTES de uma serie
 * (Parcelado / Recorrente). Porte fiel de
 * api-nairim-v2/src/utils/seriesPropagation.ts.
 *
 * O cliente informa em `propagate_fields` quais campos devem ser replicados;
 * este modulo concentra a whitelist, o acoplamento entre campos dependentes e
 * o tratamento da descricao (que carrega a numeracao da parcela).
 *
 * Camada: shared.
 */

export const PROPAGATABLE_FIELDS = [
  'amount',
  'description',
  'category_id',
  'subcategory_id',
  'financial_institution_id',
  'card_id',
  'center_id',
  'supplier_id',
] as const;

export type PropagatableField = (typeof PROPAGATABLE_FIELDS)[number];

const CATEGORY_DEPENDENTS: PropagatableField[] = ['subcategory_id', 'center_id'];

/** Filtra a lista recebida pela whitelist e arrasta os dependentes de Categoria. */
export function sanitizePropagateFields(input: unknown): PropagatableField[] {
  if (!Array.isArray(input)) return [];

  const allowed = new Set<string>(PROPAGATABLE_FIELDS);
  const fields = new Set<PropagatableField>();

  for (const raw of input) {
    const field = String(raw);
    if (allowed.has(field)) fields.add(field as PropagatableField);
  }

  if (fields.has('category_id')) {
    for (const dependent of CATEGORY_DEPENDENTS) fields.add(dependent);
  }

  return PROPAGATABLE_FIELDS.filter((field) => fields.has(field));
}

const SERIES_SUFFIX_REGEX = /^(?:(.*?)\s+-\s+)?(Parcela|Receita|Recorrente)\s+(\d+)\s*\/\s*(\d+)\s*$/;

export interface SeriesDescriptionParts {
  base: string;
  label: string | null;
  position: number | null;
  total: number | null;
}

export function parseSeriesDescription(description: unknown): SeriesDescriptionParts {
  const value = String(description ?? '').trim();
  const match = value.match(SERIES_SUFFIX_REGEX);

  if (!match) return { base: value, label: null, position: null, total: null };

  return {
    base: (match[1] ?? '').trim(),
    label: match[2],
    position: Number(match[3]),
    total: Number(match[4]),
  };
}

/** Monta a descricao de um alvo preservando a numeracao DELE. */
export function buildPropagatedDescription(newDescription: unknown, targetDescription: unknown): string {
  const { base } = parseSeriesDescription(newDescription);
  const target = parseSeriesDescription(targetDescription);

  const fallback = String(newDescription ?? '').trim();

  if (target.label === null) return base || fallback;

  const suffix = `${target.label} ${target.position}/${target.total}`;
  return base ? `${base} - ${suffix}` : suffix;
}