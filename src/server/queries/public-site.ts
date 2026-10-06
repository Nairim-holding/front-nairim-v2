import 'server-only';
import prisma from '@/infra/database/prisma';
import { NotFoundError } from '@/core/errors/domain-errors';

export async function getPublicSiteCompanySlug(): Promise<string> {
  const settings = await prisma.publicSiteSettings.findUnique({
    where: { id: 'main' },
    include: { company: { select: { slug: true, is_active: true, deleted_at: true } } },
  });
  if (!settings) return process.env.NEXT_PUBLIC_COMPANY_SLUG ?? 'nairim';
  if (!settings.company.is_active || settings.company.deleted_at) {
    throw new NotFoundError('A empresa da página principal está indisponível');
  }
  return settings.company.slug;
}
