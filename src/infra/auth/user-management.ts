import { assertAdmin } from './session';
import prisma from '@/infra/database/prisma';
import type { DecodedSessionToken } from '@/core/cryptography/token-signer';
import { ForbiddenError, NotFoundError } from '@/core/errors/domain-errors';

export async function assertCanManageUser(session: DecodedSessionToken, id?: string): Promise<void> {
  assertAdmin(session);
  if (!id) return;
  const target = await prisma.user.findFirst({ where: { id }, select: { role: true } });
  if (!target) throw new NotFoundError('Usuário não encontrado');
  if (target.role === 'SUPER_ADMIN' && session.role !== 'SUPER_ADMIN') {
    throw new ForbiddenError('Apenas super administrador pode modificar esta conta.');
  }
}

export async function assertUserGroupInTenant(groupId: string | null | undefined): Promise<void> {
  if (!groupId) return;
  const group = await prisma.userGroup.findFirst({ where: { id: groupId, deleted_at: null }, select: { id: true } });
  if (!group) throw new NotFoundError('Grupo de usuário não encontrado');
}
