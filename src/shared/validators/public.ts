import type { PublicListParams } from '@/core/entities/public-property';

/**
 * Validação/parse dos parâmetros de query das rotas públicas.
 * Fonte fiel: api-nairim-v2/src/utils/validation.ts (`ValidationUtil`) e o
 * helper `listParams` de `PublicController` (`limit` default 12; page default 1).
 *
 * Camada: shared.
 */

const singleString = (param: unknown): string | undefined => {
  if (param === undefined || param === null) return undefined;
  if (Array.isArray(param)) return String(param[0]);
  return String(param);
};

const singleNumber = (param: unknown, fallback: number): number => {
  const value = singleString(param);
  if (!value) return fallback;
  const num = parseInt(value, 10);
  return Number.isNaN(num) ? fallback : num;
};

/** Espelha `PublicController.listParams(req)` do backend. */
export function parsePublicListParams(raw: Record<string, unknown>, defaultLimit = 12): PublicListParams {
  return {
    limit: singleNumber(raw.limit, defaultLimit),
    page: singleNumber(raw.page, 1),
    search: singleString(raw.search) || '',
  };
}