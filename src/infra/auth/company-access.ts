import prisma from '@/infra/database/prisma';
import { tenantStorage } from '@/infra/database/tenant-context';
import { ForbiddenError, UnauthorizedError, ValidationError } from '@/core/errors/domain-errors';
import type { DecodedSessionToken } from '@/core/cryptography/token-signer';

export async function getCompanyAccessUser(id: string) {
  const user = await tenantStorage.exit(() => prisma.user.findFirst({
    where: { id, deleted_at: null, is_active: true },
    select: { company_id: true, role: true, all_companies_access: true, allowed_company_ids: true },
  }));
  if (!user) throw new UnauthorizedError('Usuário indisponível.');
  return user;
}

export async function listAccessibleCompanies(userId: string) {
  const user = await getCompanyAccessUser(userId);
  return prisma.company.findMany({
    where: { deleted_at: null, is_active: true,
      ...(user.role === 'SUPER_ADMIN' || user.all_companies_access ? {} : { id: { in: [user.company_id, ...user.allowed_company_ids] } }),
    },
    select: { id: true, name: true, slug: true, is_active: true, branding: { select: {
      company_name: true, trade_name: true, logo_url: true, logo_dark_url: true, primary_color: true,
    } } },
    orderBy: { name: 'asc' },
  });
}

export async function assertCompanyAccessGrant(session: DecodedSessionToken, data: {
  all_companies_access?: boolean; allowed_company_ids?: string[];
}) {
  if (data.all_companies_access === undefined && data.allowed_company_ids === undefined) return;
  if (session.role !== 'SUPER_ADMIN') throw new ForbiddenError('Somente o super administrador pode definir acessos por empresa.');
  const ids = [...new Set(data.allowed_company_ids ?? [])];
  if (ids.length && await prisma.company.count({ where: { id: { in: ids }, deleted_at: null, is_active: true } }) !== ids.length) {
    throw new ValidationError('Selecione apenas empresas ativas.');
  }
  data.allowed_company_ids = ids;
}
