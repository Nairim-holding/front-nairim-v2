/**
 * Serviço de imóveis da vitrine — agora via Server Actions.
 *
 * Substitui as chamadas `fetch()` ao `/public/:slug/*` do Express
 * (property-service.ts anterior usava `NEXT_PUBLIC_URL_API`). O tenant é
 * resolvido no servidor a partir do slug; não há JWT nem CORS no cliente.
 *
 * @slugs uso em Client Components ("use client"): o módulo abaixo apenas
 * invoca as Server Actions declaradas em @/server/actions/public.
 */

import { getPublicPropertiesAction, getPublicPropertyByIdAction } from "@/server/actions/public";
import type { Property, PropertyFilters, PaginatedResponse } from "@/types";

const SLUG = 'nairim';

function toError(result: { ok: false; error: string }): Error {
  return new Error(result.error);
}

export const propertyService = {
  async getAll(filters: PropertyFilters = {}): Promise<PaginatedResponse<Property>> {
    const result = await getPublicPropertiesAction(SLUG, filters as unknown as Record<string, unknown>);
    if (!result.ok) throw toError(result);
    // Retorna o envelope { items, meta } — compatível com o que PropertyList/
    // ApartmentRentals/HouseRentals esperam (`response.data?` / `response.items`).
    // (items são PublicProperty — shape da vitrine, não o Property full do CRUD.)
    return { ...(result.data as unknown as PaginatedResponse<Property>), success: true };
  },

  /** @alias getAll — mantido para compatibilidade com imports existentes */
  getAllProperties(filters: PropertyFilters = {}): Promise<PaginatedResponse<Property>> {
    return this.getAll(filters);
  },

  async getById(id: string): Promise<Property | null> {
    const result = await getPublicPropertyByIdAction(SLUG, id);
    if (!result.ok) throw toError(result);
    return result.data as unknown as Property;
  },
};