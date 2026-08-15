'use server';

import { propertyUseCases } from '@/infra/factories/property-factory';
import { createUnifiedPropertySchema, updateUnifiedPropertySchema } from '@/shared/validators/property';
import { type ActionResult, runAction } from '@/shared/actions/action-result';
import { withTenant } from '@/infra/auth/session';
import { readJsonField, readStringField, readPropertyUploadFiles } from '@/shared/http/form-data';
import { ValidationError } from '@/core/errors/domain-errors';
import type { CreateUnifiedPropertyData, PaginatedProperties, Property } from '@/core/entities/property';
import { listPropertiesData, getPropertyByIdData, getPropertyFiltersData } from '@/server/queries/property';

/**
 * Server Actions do módulo Properties (fluxo unificado). Substituem
 * `POST /properties/create-unified` e `PUT /properties/update-unified/:id`.
 * Guarda: `withTenant`. Camada: server.
 *
 * Origem: api-nairim-v2/src/controllers/PropertyController.ts
 * (createUnifiedProperty/updateUnifiedProperty).
 */

/** Monta o payload combinado (propertyData + address + values + iptus) a partir do FormData. */
function parseUnifiedFormData(fd: FormData): Record<string, unknown> {
  const propertyData = readJsonField<Record<string, unknown>>(fd, 'propertyData');
  const addressData = readJsonField<Record<string, unknown>>(fd, 'addressData');
  const valuesData = readJsonField<Record<string, unknown>>(fd, 'valuesData');
  const iptusData = readJsonField<unknown[]>(fd, 'iptusData') ?? [];

  if (!propertyData || !addressData || !valuesData) {
    throw new ValidationError('Campos obrigatórios ausentes');
  }

  return { ...propertyData, address: addressData, values: valuesData, iptus: iptusData };
}

/**
 * Cria imóvel com upload de documentos (fluxo unificado).
 * Origem: POST /properties/create-unified.
 */
export async function createUnifiedPropertyAction(formData: FormData): Promise<ActionResult<Property>> {
  return runAction(async () => {
    const combined = parseUnifiedFormData(formData);
    const data = createUnifiedPropertySchema.parse(combined) as unknown as CreateUnifiedPropertyData;

    const userId = readStringField(formData, 'userId');
    const featuredImageIdentifier = readStringField(formData, 'featuredImageIdentifier') || undefined;
    const files = await readPropertyUploadFiles(formData);

    return withTenant(() =>
      propertyUseCases.createUnified.execute({ data, files, userId, featuredImageIdentifier }),
    );
  });
}

/**
 * Atualiza imóvel com upload de novos documentos e remoção dos marcados
 * (fluxo unificado). Origem: PUT /properties/update-unified/:id.
 */
export async function updateUnifiedPropertyAction(id: string, formData: FormData): Promise<ActionResult<Property>> {
  return runAction(async () => {
    const combined = parseUnifiedFormData(formData);
    const data = updateUnifiedPropertySchema.parse(combined) as unknown as CreateUnifiedPropertyData;

    const userId = readStringField(formData, 'userId');
    const featuredImageIdentifier = readStringField(formData, 'featuredImageIdentifier') || undefined;
    const removedDocuments = readJsonField<string[]>(formData, 'removedDocuments') ?? [];
    const files = await readPropertyUploadFiles(formData);

    return withTenant(() =>
      propertyUseCases.updateUnified.execute(id, { data, files, userId, removedDocuments, featuredImageIdentifier }),
    );
  });
}

/** Soft-delete. Origem: DELETE /properties/:id. */
export async function deletePropertyAction(id: string): Promise<ActionResult<Property>> {
  return runAction(() => withTenant(() => propertyUseCases.remove.execute(id)));
}

/** Restaura. Origem: PATCH /properties/:id/restore. */
export async function restorePropertyAction(id: string): Promise<ActionResult<Property>> {
  return runAction(() => withTenant(() => propertyUseCases.restore.execute(id)));
}

// ─── Leituras expostas como action (para Client Components) ─────────────────

export async function listPropertiesAction(raw: Record<string, unknown>): Promise<ActionResult<PaginatedProperties>> {
  return runAction(() => listPropertiesData(raw));
}

export async function getPropertyByIdAction(id: string): Promise<ActionResult<Property>> {
  return runAction(() => getPropertyByIdData(id));
}

export async function getPropertyFiltersAction(raw: Record<string, unknown>): Promise<ActionResult<Record<string, unknown>>> {
  return runAction(() => getPropertyFiltersData(raw));
}
