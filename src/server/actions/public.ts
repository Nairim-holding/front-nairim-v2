'use server';

import { type ActionResult, runAction } from '@/shared/actions/action-result';
import {
  getPublicPropertiesData,
  getPublicPropertyByIdData,
  getPublicPropertyTypesData,
} from '@/server/queries/public';
import type {
  PublicPaginated,
  PublicProperty,
  PublicPropertyType,
} from '@/core/entities/public-property';

/**
 * Server Actions da vitrine PÚBLICA (para Client Components).
 * Substituem o `fetch` ao `/public/:companySlug/*` do Express — sem token,
 * sem CORS: o tenant vem do slug resolvido no servidor.
 *
 * Camada: server. Origem: PublicController.
 */

export async function getPublicPropertiesAction(
  slug: string,
  raw?: Record<string, unknown>,
  opts?: { availableOnly?: boolean },
): Promise<ActionResult<PublicPaginated<PublicProperty>>> {
  return runAction(() => getPublicPropertiesData(slug, raw ?? {}, opts));
}

export async function getPublicPropertyByIdAction(
  slug: string,
  id: string,
): Promise<ActionResult<PublicProperty | null>> {
  return runAction(() => getPublicPropertyByIdData(slug, id));
}

export async function getPublicPropertyTypesAction(
  slug: string,
  raw?: Record<string, unknown>,
): Promise<ActionResult<PublicPaginated<PublicPropertyType>>> {
  return runAction(() => getPublicPropertyTypesData(slug, raw ?? {}));
}