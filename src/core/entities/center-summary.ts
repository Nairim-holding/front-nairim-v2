export interface CenterSummaryRow { id: string | null; name: string; income: number; expense: number; balance: number }
interface SummaryCenter { id: string; name: string; company_id?: string; type?: string }
interface SummaryProperty { id: string; title: string; company_id: string; center_id: string | null; debit_center_id: string | null }

const centerBaseName = (name: string) => name.replace(/\s*\((CR|DB)\)\s*$/i, '').trim();

/** Pair the property's credit/debit centers; named legacy pairs are a fallback. */
function centerGroups(centers: SummaryCenter[], properties: SummaryProperty[]) {
  const byId = new Map(centers.map(center => [center.id, center]));
  const groups = new Map<string, { id: string; name: string }>();
  const owners = new Map<string, Set<string>>();
  for (const property of properties) for (const id of [property.center_id, property.debit_center_id]) {
    if (!id) continue;
    const ids = owners.get(id) ?? new Set<string>();
    ids.add(property.id); owners.set(id, ids);
  }
  for (const property of properties) {
    const ids = [property.center_id, property.debit_center_id].filter((id): id is string => !!id);
    if (ids.length !== 2 || ids[0] === ids[1] || ids.some(id => owners.get(id)?.size !== 1)) continue;
    if (ids.some(id => byId.get(id)?.company_id && byId.get(id)?.company_id !== property.company_id)) continue;
    const group = { id: `property:${property.id}`, name: property.title };
    ids.forEach(id => groups.set(id, group));
  }
  const pairs = new Map<string, { CR: SummaryCenter[]; DB: SummaryCenter[] }>();
  for (const center of centers) {
    if (groups.has(center.id) || (owners.get(center.id)?.size ?? 0) > 1) continue;
    const match = /\((CR|DB)\)\s*$/i.exec(center.name);
    if (!match) continue;
    const side = match[1].toUpperCase() as 'CR' | 'DB';
    if (center.type && center.type !== (side === 'CR' ? 'INCOME' : 'EXPENSE')) continue;
    const name = centerBaseName(center.name);
    if (!name) continue;
    const key = JSON.stringify([center.company_id ?? '', name.replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')]);
    const pair = pairs.get(key) ?? { CR: [], DB: [] };
    pair[side].push(center); pairs.set(key, pair);
  }
  for (const pair of pairs.values()) {
    // Ambiguous names and unrelated companies must remain independent.
    if (pair.CR.length !== 1 || pair.DB.length !== 1) continue;
    const creditOwners = owners.get(pair.CR[0].id);
    const debitOwners = owners.get(pair.DB[0].id);
    if (creditOwners && debitOwners && ![...creditOwners].some(id => debitOwners.has(id))) continue;
    const group = { id: pair.CR[0].id, name: centerBaseName(pair.CR[0].name) };
    groups.set(pair.CR[0].id, group); groups.set(pair.DB[0].id, group);
  }
  return groups;
}

export function buildCenterSummary(
  totals: { center_id: string | null; category_id: string; amount: number }[],
  centers: SummaryCenter[], categories: { id: string; type: string }[],
  properties: SummaryProperty[] = [],
): CenterSummaryRow[] {
  const names = new Map(centers.map(center => [center.id, center.name]));
  const types = new Map(categories.map(category => [category.id, category.type]));
  const groups = centerGroups(centers, properties);
  const result = new Map<string | null, CenterSummaryRow>();
  for (const total of totals) {
    const type = types.get(total.category_id);
    if (type !== 'INCOME' && type !== 'EXPENSE') continue;
    const group = total.center_id ? groups.get(total.center_id) : undefined;
    const id = group?.id ?? total.center_id;
    const row = result.get(id) ?? { id, name: group?.name ?? (total.center_id ? names.get(total.center_id) ?? 'Centro excluído' : 'Sem centro'), income: 0, expense: 0, balance: 0 };
    row[type === 'INCOME' ? 'income' : 'expense'] += total.amount;
    row.balance = Math.round((row.income - row.expense) * 100) / 100;
    result.set(id, row);
  }
  return [...result.values()].sort((a,b) => b.income + b.expense - a.income - a.expense);
}
