import prisma from '@/infra/database/prisma';
import type { DecodedSessionToken } from '@/core/cryptography/token-signer';
import { assertSessionClaims } from '@/core/cryptography/session-claims';
import { UnauthorizedError } from '@/core/errors/domain-errors';
import { isWithinAccessSchedule } from './access-schedule';

/** Recheck server-side authority on every request, including token refresh. */
export async function validateLiveSession(claims: unknown): Promise<DecodedSessionToken> {
  assertSessionClaims(claims);
  const user = await prisma.user.findFirst({
    where: { id: claims.id, deleted_at: null, is_active: true },
    select: {
      id: true, name: true, email: true, role: true, company_id: true,
      has_time_restriction: true,
      access_schedules: { select: { day_of_week: true, start_time: true, end_time: true } },
    },
  });
  if (!user || (user.role !== 'SUPER_ADMIN' && user.company_id !== claims.company_id)) {
    throw new UnauthorizedError('Sessão revogada. Faça login novamente.');
  }
  if (user.has_time_restriction && !isWithinAccessSchedule(user.access_schedules)) {
    throw new UnauthorizedError('Acesso fora do horário permitido.');
  }
  const company = await prisma.company.findFirst({
    where: { id: claims.company_id, deleted_at: null, is_active: true },
    select: { id: true },
  });
  if (!company) throw new UnauthorizedError('Empresa indisponível.');
  const roles: Record<string, string> = { ADMIN: 'administrador', DEFAULT: 'usuário' };
  return { ...claims, name: user.name, email: user.email, role: roles[user.role] ?? user.role };
}
