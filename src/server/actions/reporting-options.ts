'use server';

import prisma from '@/infra/database/prisma';
import { withPermission } from '@/infra/auth/session';
import { withReportingScope } from '@/infra/auth/reporting-scope';
import { loadReportingTaxonomy } from '@/infra/repositories/reporting-catalog';
import { runAction } from '@/shared/actions/action-result';
import { isConsolidatedReporting } from '@/infra/database/reporting-context';

export async function getReportingOptionsAction(raw: Record<string, unknown> = {}) {
  return runAction(() => withPermission('financial-reports', 'view', session => withReportingScope(session, raw, async () => {
    const [taxonomy, institutions, cards, centers] = await Promise.all([
      loadReportingTaxonomy(),
      prisma.financialInstitution.findMany({ where: { deleted_at: null }, select: { id: true, name: true, is_active: true }, orderBy: { name: 'asc' } }),
      prisma.card.findMany({ where: { deleted_at: null, is_active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      prisma.center.findMany({ where: { deleted_at: null }, select: { id: true, name: true, type: true }, orderBy: { name: 'asc' } }),
    ]);
    const representative = new Map<string, string>();
    const categories = taxonomy.categories.filter(c => {
      const key = isConsolidatedReporting() ? taxonomy.categoryKeys.get(c.id)! : c.id;
      if (representative.has(key)) return false;
      representative.set(key, c.id); return true;
    });
    const subcategoriesByCategory: Record<string, { label: string; value: string }[]> = {};
    const seen = new Set<string>();
    for (const s of taxonomy.subcategories) {
      const key = isConsolidatedReporting() ? taxonomy.subcategoryKeys.get(s.id)! : s.id;
      if (seen.has(key)) continue;
      seen.add(key);
      const parent = representative.get(isConsolidatedReporting() ? taxonomy.categoryKeys.get(s.category_id)! : s.category_id);
      if (!parent) continue;
      (subcategoriesByCategory[parent] ??= []).push({ label: s.name, value: s.id });
    }
    return { institutions: institutions.map(i => ({ label: i.name, value: i.id, isActive: i.is_active })),
      cards: cards.map(c => ({ label: c.name, value: c.id })),
      incomeCategories: categories.filter(c => c.type === 'INCOME').map(c => ({ label: c.name, value: c.id })),
      expenseCategories: categories.filter(c => c.type === 'EXPENSE').map(c => ({ label: c.name, value: c.id })),
      subcategoriesByCategory, centers: centers.map(c => ({ label: c.name, value: c.id, type: c.type })) };
  })));
}

export async function getReportingCategoriesAction(raw: Record<string, unknown> = {}) {
  return runAction(() => withPermission('financial-categories', 'view', session => withReportingScope(session, raw, async () => {
    const { categories, categoryKeys } = await loadReportingTaxonomy();
    const seen = new Set<string>();
    return categories.filter(c => { const key = isConsolidatedReporting() ? categoryKeys.get(c.id)! : c.id; if (seen.has(key)) return false; seen.add(key); return true; });
  })));
}
