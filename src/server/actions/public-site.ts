'use server';

import prisma from '@/infra/database/prisma';
import { assertSuperAdmin, requireSession } from '@/infra/auth/session';
import { runAction } from '@/shared/actions/action-result';
import { ValidationError } from '@/core/errors/domain-errors';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export async function getPublicSiteSettingsAction() {
  return runAction(async () => {
    assertSuperAdmin(await requireSession());
    const [companies, settings] = await Promise.all([
      prisma.company.findMany({ where: { is_active: true, deleted_at: null }, select: { id: true, name: true, slug: true }, orderBy: { name: 'asc' } }),
      prisma.publicSiteSettings.findUnique({ where: { id: 'main' } }),
    ]);
    const fallback = companies.find(company => company.slug === (process.env.NEXT_PUBLIC_COMPANY_SLUG ?? 'nairim'));
    return { companies, companyId: settings?.company_id ?? fallback?.id ?? '' };
  });
}

export async function savePublicSiteSettingsAction(companyId: string) {
  return runAction(async () => {
    assertSuperAdmin(await requireSession());
    const id = z.string().uuid().parse(companyId);
    const company = await prisma.company.findFirst({ where: { id, is_active: true, deleted_at: null }, select: { id: true } });
    if (!company) throw new ValidationError('Selecione uma empresa ativa.');
    await prisma.publicSiteSettings.upsert({ where: { id: 'main' }, create: { id: 'main', company_id: id }, update: { company_id: id } });
    revalidatePath('/', 'layout');
    return { companyId: id };
  });
}
