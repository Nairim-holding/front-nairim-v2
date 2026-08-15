'use server';

import { propertyTypeUseCases } from '@/infra/factories/property-type-factory';
import { createPropertyTypeSchema, updatePropertyTypeSchema } from '@/shared/validators/property-type';
import { type ActionResult, runAction } from '@/shared/actions/action-result';
import { withTenant } from '@/infra/auth/session';
import type { PaginatedPropertyTypes, PropertyType } from '@/core/entities/property-type';
import {
  listPropertyTypesData,
  getPropertyTypeByIdData,
  getPropertyTypeFiltersData,
} from '@/server/queries/property-type';

/**
 * Server Actions do módulo Property-types. Substituem `/property-types/*`.
 * Guarda: `withTenant`. Camada: server. Origem: PropertyTypeController.ts.
 */

export async function createPropertyTypeAction(input: Record<string, unknown>): Promise<ActionResult<PropertyType>> {
  return runAction(async () => {
    const data = createPropertyTypeSchema.parse(input);
    return withTenant(() => propertyTypeUseCases.create.execute(data));
  });
}

export async function updatePropertyTypeAction(id: string, input: Record<string, unknown>): Promise<ActionResult<PropertyType>> {
  return runAction(async () => {
    const data = updatePropertyTypeSchema.parse(input);
    return withTenant(() => propertyTypeUseCases.update.execute(id, data));
  });
}

export async function deletePropertyTypeAction(id: string): Promise<ActionResult<PropertyType>> {
  return runAction(() => withTenant(() => propertyTypeUseCases.remove.execute(id)));
}

export async function restorePropertyTypeAction(id: string): Promise<ActionResult<PropertyType>> {
  return runAction(() => withTenant(() => propertyTypeUseCases.restore.execute(id)));
}

// ─── Leituras expostas como action (para Client Components) ─────────────────

export async function listPropertyTypesAction(raw: Record<string, unknown>): Promise<ActionResult<PaginatedPropertyTypes>> {
  return runAction(() => listPropertyTypesData(raw));
}

export async function getPropertyTypeByIdAction(id: string): Promise<ActionResult<PropertyType>> {
  return runAction(() => getPropertyTypeByIdData(id));
}

export async function getPropertyTypeFiltersAction(raw: Record<string, unknown>): Promise<ActionResult<Record<string, unknown>>> {
  return runAction(() => getPropertyTypeFiltersData(raw));
}
