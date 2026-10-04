'use server';
import { z } from 'zod';
import { withPermission, withPermissionInput } from '@/infra/auth/session';
import { repairsRepository } from '@/infra/repositories/prisma-repairs-repository';
import { repairSchema, repairListSchema } from '@/shared/validators/repair';
import { runAction } from '@/shared/actions/action-result';
import { ValidationError } from '@/core/errors/domain-errors';

export async function listRepairsAction(raw: Record<string, unknown>) {
  return runAction(() => withPermission('repairs', 'view', () => repairsRepository.list(repairListSchema.parse(raw))));
}
export async function getRepairPropertiesAction() {
  return runAction(() => withPermission('repairs', 'view', () => repairsRepository.properties()));
}
export async function saveRepairAction(id: string | null, raw: Record<string, unknown>) {
  return runAction(() => withPermissionInput('repairs', id ? 'edit' : 'create', raw, session =>
    repairsRepository.save(session.company_id, id ? z.string().uuid().parse(id) : null, repairSchema.parse(raw))));
}
export async function deleteRepairAction(id: string) {
  return runAction(async () => { await withPermission('repairs', 'delete', () => repairsRepository.remove(z.string().uuid().parse(id))); return null; });
}
export async function uploadRepairMediaAction(id: string, form: FormData) {
  return runAction(() => withPermission('repairs', 'edit', session => {
    const stage = z.enum(['BEFORE', 'AFTER']).parse(form.get('stage'));
    const file = form.get('file');
    if (!(file instanceof File)) throw new ValidationError('Selecione uma mídia');
    return repairsRepository.upload(session.company_id, z.string().uuid().parse(id), stage, file);
  }));
}
export async function deleteRepairMediaAction(id: string, mediaId: string) {
  return runAction(async () => { await withPermission('repairs', 'delete', () => repairsRepository.removeMedia(z.string().uuid().parse(id), z.string().uuid().parse(mediaId))); return null; });
}
