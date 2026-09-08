'use server';

import { leaseUseCases } from '@/infra/factories/lease-factory';
import { createLeaseSchema, updateLeaseSchema, validateLeaseBusinessRules } from '@/shared/validators/lease';
import { type ActionResult, runAction } from '@/shared/actions/action-result';
import { withPermission, withPermissionInput } from '@/infra/auth/session';
import { readJsonField, readStringField } from '@/shared/http/form-data';
import type { LeaseDocumentFile } from '@/core/use-cases/lease/documents';
import type {
  CancelLeaseInput,
  CancelLeaseResult,
  CancellationPreview,
  CreateLeaseData,
  Lease,
  PaginatedLeases,
  UpdateLeaseData,
} from '@/core/entities/lease';
import {
  listLeasesData,
  getLeaseByIdData,
  getLeaseFiltersData,
  getCancellationPreviewData,
} from '@/server/queries/lease';

/**
 * Server Actions do módulo Leases. Substituem os endpoints de `/leases`.
 * Guarda: `withTenant`. Camada: server. Origem: LeaseController.ts.
 *
 * ⚠️ `create`/`update` retornam também `warnings` (avisos NÃO bloqueantes de
 * `validateLeaseBusinessRules` + `finance_warning` da sincronização financeira)
 * — mesmo contrato do backend, que anexava `warnings` à resposta de sucesso.
 */

/** Lease + avisos não bloqueantes (regras de negócio/IPTU + financeiro). */
export type LeaseWithWarnings = Lease & { warnings?: string[] };

/**
 * Cria locação. Origem: POST /leases (createLease).
 * Valida (Zod, bloqueante) → regras de negócio (warnings, não bloqueantes) →
 * cria → sincroniza lançamentos financeiros (falha vira warning).
 */
export async function createLeaseAction(input: Record<string, unknown>): Promise<ActionResult<LeaseWithWarnings>> {
  return runAction(async () => {
    const data = createLeaseSchema.parse(input) as unknown as CreateLeaseData;
    const businessWarnings = validateLeaseBusinessRules(input, false);

    const lease = await withPermissionInput('leases', 'create', input, () => leaseUseCases.create.execute(data));

    const warnings = [...businessWarnings];
    if (lease.finance_warning) warnings.push(lease.finance_warning);
    const { finance_warning: _fw, ...rest } = lease; // eslint-disable-line @typescript-eslint/no-unused-vars
    return warnings.length > 0 ? { ...rest, warnings } : (rest as LeaseWithWarnings);
  });
}

/**
 * Atualiza locação. Origem: PUT /leases/:id (updateLease).
 * Mesmo fluxo de warnings do create (validação em modo update = campos parciais).
 */
export async function updateLeaseAction(id: string, input: Record<string, unknown>): Promise<ActionResult<LeaseWithWarnings>> {
  return runAction(async () => {
    const data = updateLeaseSchema.parse(input) as unknown as UpdateLeaseData;
    const businessWarnings = validateLeaseBusinessRules(input, true);

    const lease = await withPermissionInput('leases', 'edit', input, () => leaseUseCases.update.execute(id, data));

    const warnings = [...businessWarnings];
    if (lease.finance_warning) warnings.push(lease.finance_warning);
    const { finance_warning: _fw, ...rest } = lease; // eslint-disable-line @typescript-eslint/no-unused-vars
    return warnings.length > 0 ? { ...rest, warnings } : (rest as LeaseWithWarnings);
  });
}

/** Soft-delete (marca CANCELED + soft-delete). Origem: DELETE /leases/:id. */
export async function deleteLeaseAction(id: string): Promise<ActionResult<Lease>> {
  return runAction(() => withPermission('leases', 'delete', () => leaseUseCases.remove.execute(id)));
}

/** Exclusão definitiva (hard delete + lançamentos). Origem: DELETE /leases/:id/permanently. */
export async function permanentlyDeleteLeaseAction(id: string): Promise<ActionResult<Lease>> {
  return runAction(() => withPermission('leases', 'delete', () => leaseUseCases.permanentlyRemove.execute(id)));
}

/** Restaura locação soft-deletada. Origem: PATCH /leases/:id/restore. */
export async function restoreLeaseAction(id: string): Promise<ActionResult<Lease>> {
  return runAction(() => withPermission('leases', 'edit', () => leaseUseCases.restore.execute(id)));
}

/**
 * Efetiva o cancelamento: soft-delete dos lançamentos confirmados a partir da
 * data, encargo opcional, marca CANCELED e libera o imóvel.
 * Origem: POST /leases/:id/cancel (cancelLease) — `company_id` vem da sessão,
 * como o controller lia de `req.user`.
 */
export async function cancelLeaseAction(id: string, input: CancelLeaseInput): Promise<ActionResult<CancelLeaseResult>> {
  return runAction(() =>
    withPermissionInput('leases', 'edit', input, (session) => leaseUseCases.cancel.execute(id, input, session.company_id)),
  );
}

/**
 * Anexa/remove documentos da locação (ex.: contrato). Multipart via FormData:
 * arquivos novos no campo `arquivosLocacao`, `removedDocuments` (JSON de ids)
 * e `userId` — mesmo contrato do PUT /leases/:id/documents.
 *
 * Mesma decisão do Módulo 7: Server Action síncrona (o antigo fluxo
 * busboy/useUploadSSE com resposta antecipada não existe em Server Actions);
 * retorna a locação atualizada (o controller respondia com getLeaseById).
 * Origem: LeaseController.updateLeaseDocuments.
 */
export async function updateLeaseDocumentsAction(id: string, formData: FormData): Promise<ActionResult<Lease>> {
  return runAction(async () => {
    const userId = readStringField(formData, 'userId');
    const removedDocumentIds = readJsonField<string[]>(formData, 'removedDocuments') ?? [];

    const newFiles: LeaseDocumentFile[] = [];
    for (const entry of formData.getAll('arquivosLocacao')) {
      if (!(entry instanceof File)) continue;
      newFiles.push({
        buffer: Buffer.from(await entry.arrayBuffer()),
        filename: entry.name,
        contentType: entry.type || 'application/octet-stream',
      });
    }

    return withPermission('leases', 'edit', async () => {
      await leaseUseCases.updateDocuments.execute({ leaseId: id, userId, removedDocumentIds, newFiles });
      return leaseUseCases.getById.execute(id);
    });
  });
}

// ─── Leituras expostas como action (para Client Components) ─────────────────

export async function listLeasesAction(raw: Record<string, unknown>): Promise<ActionResult<PaginatedLeases>> {
  return runAction(() => listLeasesData(raw));
}

export async function getLeaseByIdAction(id: string): Promise<ActionResult<Lease>> {
  return runAction(() => getLeaseByIdData(id));
}

export async function getLeaseFiltersAction(raw: Record<string, unknown>): Promise<ActionResult<Record<string, unknown>>> {
  return runAction(() => getLeaseFiltersData(raw));
}

/** Prévia dos lançamentos a excluir no cancelamento. Origem: GET /leases/:id/cancellation-preview. */
export async function getCancellationPreviewAction(id: string, date: string): Promise<ActionResult<CancellationPreview>> {
  return runAction(() => getCancellationPreviewData(id, date));
}

/*
 * Migrado de:
 *  - api-nairim-v2/src/controllers/LeaseController.ts (todos os handlers)
 *  - api-nairim-v2/src/routes/lease.ts (GET/POST /, GET /:id, PUT /:id,
 *    DELETE /:id, DELETE /:id/permanently, PATCH /:id/restore,
 *    PUT /:id/documents, GET /:id/cancellation-preview, POST /:id/cancel,
 *    GET /filters)
 */
