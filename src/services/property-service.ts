/**
 * Serviço de imóveis — comunicação com a API REST de propriedades.
 *
 * Utilizado no lado do cliente (componentes com "use client").
 * Para busca server-side, use os Server Actions ou Route Handlers.
 */

import type { Property, PropertyFilters, PaginatedResponse } from '@/types';

// Em client components o browser usa o proxy local (/api/backend) para evitar CORS.
// Em server components o Node.js chama o backend direto (sem CORS).
const API_URL = process.env.NEXT_PUBLIC_URL_API ?? 'https://nairim.com.br/backend';

const SLUG = 'nairim';
const PUB = `/public/${SLUG}`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildQueryString(params: Record<string, unknown>): string {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      qs.append(key, String(value));
    }
  });
  return qs.toString();
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  console.log("Chamando URL:", `${API_URL}${path}`);
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`[${res.status}] ${path}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const propertyService = {
  getAll(filters: PropertyFilters = {}): Promise<PaginatedResponse<Property>> {
    const qs = buildQueryString(filters as Record<string, unknown>);
    return apiFetch<PaginatedResponse<Property>>(`${PUB}/properties?${qs}`);
  },

  /** @alias getAll — mantido para compatibilidade com imports existentes */
  getAllProperties(filters: PropertyFilters = {}): Promise<PaginatedResponse<Property>> {
    return this.getAll(filters);
  },

  getById(id: string): Promise<Property> {
    return apiFetch<Property>(`${PUB}/properties/${id}`);
  },

  getDocuments(propertyId: string): Promise<Property['documents']> {
    return apiFetch(`${PUB}/properties/${propertyId}/documents`);
  },

  getTypes(): Promise<Array<{ id: string; name: string; description: string }>> {
    return apiFetch(`${PUB}/property-types`);
  },
};
