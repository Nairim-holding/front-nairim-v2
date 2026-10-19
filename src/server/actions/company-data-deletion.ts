'use server';

import { z } from 'zod';
import { withPermission, assertAdmin } from '@/infra/auth/session';
import { prismaUserGroupPermissionsRepository } from '@/infra/repositories/prisma-user-group-permissions-repository';
import { runAction } from '@/shared/actions/action-result';
import { DELETION_GROUPS, type DeletionGroupKey } from '@/shared/data/company-data-deletion';
import { deleteCompanyData, previewCompanyDataDeletion } from '@/server/services/company-data-deletion';
import { ForbiddenError, ValidationError } from '@/core/errors/domain-errors';

const selection = z.object({
  companyId: z.string().min(1),
  groups: z.array(z.string()).min(1).max(DELETION_GROUPS.length).refine(values => new Set(values).size === values.length && values.every(key => DELETION_GROUPS.some(group => group.key === key)), 'Seleção de dados inválida.'),
});
async function authorized<T>(raw: unknown, fn: (companyId: string, groups: DeletionGroupKey[]) => Promise<T>) {
  return withPermission('settings', 'delete', async session => {
    assertAdmin(session);
    const input = selection.parse(raw);
    if (input.companyId !== session.company_id) throw new ForbiddenError('A empresa atual mudou. Reabra a exclusão de dados.');
    const groups = input.groups as DeletionGroupKey[];
    if (session.role !== 'SUPER_ADMIN') {
      const permissions = await prismaUserGroupPermissionsRepository.resolveForUser(session.id);
      if (permissions !== null && !DELETION_GROUPS.filter(group => groups.includes(group.key)).every(group => permissions.get(group.resource)?.has('delete'))) throw new ForbiddenError('Sem permissão para excluir um dos grupos selecionados.');
    }
    return fn(session.company_id, groups);
  });
}
export async function previewCompanyDataDeletionAction(input: unknown) {
  return runAction(() => authorized(input, previewCompanyDataDeletion));
}
export async function deleteCompanyDataAction(input: unknown) {
  return runAction(() => authorized(input, (companyId, groups) => {
    if (!input || typeof input !== 'object' || !('confirmation' in input) || input.confirmation !== 'CONFIRMAR') throw new ValidationError('Digite exatamente CONFIRMAR, em maiúsculas.');
    return deleteCompanyData(companyId, groups);
  }));
}
