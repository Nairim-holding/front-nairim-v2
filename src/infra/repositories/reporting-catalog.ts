import prisma from '@/infra/database/prisma';
import { getReportingCompanyIds } from '@/infra/database/reporting-context';
import { reportingIdentity } from '@/shared/utils/reporting-identity';

export async function loadReportingTaxonomy() {
  const [categories, subcategories] = await Promise.all([
    prisma.category.findMany({ where: { deleted_at: null, is_active: true }, select: { id: true, name: true, type: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }] }),
    prisma.subcategory.findMany({ where: { deleted_at: null, is_active: true }, select: { id: true, name: true, category_id: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }] }),
  ]);
  const categoryById = new Map(categories.map(c => [c.id, c]));
  const categoryKeys = new Map(categories.map(c => [c.id, reportingIdentity(c.type, c.name)]));
  const subcategoryKeys = new Map(subcategories.map(s => {
    const parent = categoryById.get(s.category_id);
    return [s.id, reportingIdentity(parent?.type, parent?.name, s.name)];
  }));
  return { categories, subcategories, categoryById, categoryKeys, subcategoryKeys };
}

/** Expand one representative into equivalent UUIDs only within selected companies. */
export async function expandReportingFilters(raw: Record<string, unknown>) {
  if (!getReportingCompanyIds()) return raw;
  const fields = ['category_id', 'subcategory_id'];
  if (!fields.some(f => raw[f] !== undefined || raw[`filter[${f}]`] !== undefined)) return raw;
  const { categoryKeys, subcategoryKeys } = await loadReportingTaxonomy();
  const expanded = { ...raw };
  for (const field of fields) {
    const keyMap = field === 'category_id' ? categoryKeys : subcategoryKeys;
    for (const key of [field, `filter[${field}]`]) {
      if (raw[key] === undefined) continue;
      const ids = (Array.isArray(raw[key]) ? raw[key] : [raw[key]]) as unknown[];
      const selected = ids.filter((v): v is string => typeof v === 'string').flatMap(v => v.split(','));
      const identities = new Set(selected.map(id => keyMap.get(id)).filter(Boolean));
      expanded[key] = [...new Set([...selected, ...[...keyMap].filter(([, identity]) => identities.has(identity)).map(([id]) => id)])];
    }
  }
  return expanded;
}
