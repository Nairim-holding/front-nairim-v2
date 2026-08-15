/**
 * Paginação das listas públicas — cópia fiel da função `paginate` do backend
 * (api-nairim-v2/src/services/PublicService.ts).
 *
 * Pure functions: testáveis sem banco.
 * Camada: core.
 */
export interface PublicPageConfig {
  /** Quantidade efetiva (clampeada em [1, 100]). */
  take: number;
  /** Offset. */
  skip: number;
}

/** Clampea e deriva take/skip. Ex.: paginate(limit, page). */
export function paginatePublic(limit = 12, page = 1): PublicPageConfig {
  const take = Math.max(1, Math.min(limit, 100));
  const skip = (Math.max(1, page) - 1) * take;
  return { take, skip };
}

/** Meta paginada no formato do backend (`{ total, page, limit, totalPages }`). */
export function publicMeta(total: number, page: number, limit: number) {
  return { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}