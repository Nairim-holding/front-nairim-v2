import prisma from '@/infra/database/prisma';
import { Prisma } from '@/generated/prisma/client';
import { transferModels } from '@/shared/validators/table-transfer';
import { DELETION_GROUPS, type CompanyDeletionPreview, type DeletionGroupKey } from '@/shared/data/company-data-deletion';
import { getAuditActor } from '@/infra/database/audit-context';
import { ForbiddenError, ValidationError } from '@/core/errors/domain-errors';

type Tx = Pick<Prisma.TransactionClient, '$executeRaw' | '$queryRaw'>;
// Only these owned details can accompany an explicitly selected operational group.
const details: Record<string, string> = {
  PropertyValue: 'Property', PropertyIptu: 'Property', PropertyAddress: 'Property',
  OwnerAddress: 'Owner', TenantAddress: 'Tenant', AgencyAddress: 'Agency', SupplierAddress: 'Supplier',
  PlanningMonth: 'Planning', InvestmentTransaction: 'Investment', InvestmentMonthBalance: 'Investment',
  AdjustmentIndexValue: 'AdjustmentIndex', RepairProfessional: 'Repair', RepairItem: 'Repair', RepairMedia: 'Repair',
};
const contactParents = ['Agency', 'Owner', 'Tenant', 'Supplier'];
const junctions = ['AgencyAddress', 'OwnerAddress', 'TenantAddress', 'SupplierAddress', 'PropertyAddress'];
// Identifier values come exclusively from the generated schema metadata and constants, never input.
const ident = (name: string) => Prisma.raw('"' + name.replaceAll('"', '""') + '"');
const table = (model: string) => ident(model === 'Invoice' ? 'invoices' : model);
const target = (model: string, id: Prisma.Sql) => Prisma.sql`EXISTS (SELECT 1 FROM pg_temp.nairim_deletion_targets t WHERE t.model = ${model} AND t.id = ${id})`;
const ownId = Prisma.sql`r."id"`;
const selectedRef = (parent: string, field: string) => target(parent, Prisma.sql`r.${ident(field)}`);
const relationField = (child: string, parent: string) => transferModels[child].relations.find(rel => rel.model === parent)!.fields[0];
const label = (model: string) => DELETION_GROUPS.find(group => (group.models as readonly string[]).includes(model))?.label ?? ({ Contact: 'Contatos compartilhados', Address: 'Endereços compartilhados', Document: 'Documentos', LeaseNotification: 'Alertas de locações' } as Record<string, string>)[model] ?? model;

async function prepare(tx: Tx, companyId: string, groups: DeletionGroupKey[]): Promise<CompanyDeletionPreview & { models: string[] }> {
  const [company] = await tx.$queryRaw<{ id: string; name: string; slug: string }[]>`SELECT id, name, slug FROM "Company" WHERE id = ${companyId}`;
  if (!company) throw new ValidationError('Empresa não encontrada.');
  await tx.$executeRaw`CREATE TEMP TABLE nairim_deletion_targets (model text NOT NULL, id text NOT NULL, PRIMARY KEY (model, id)) ON COMMIT DROP`;
  const roots = new Set<string>(DELETION_GROUPS.filter(group => groups.includes(group.key)).flatMap(group => [...group.models]));
  const models: string[] = [];
  const add = async (model: string, where: Prisma.Sql) => {
    await tx.$executeRaw(Prisma.sql`INSERT INTO pg_temp.nairim_deletion_targets (model, id) SELECT ${model}, r.id FROM ${table(model)} r WHERE ${where} ON CONFLICT DO NOTHING`);
    models.push(model);
  };
  for (const model of roots) await add(model, Prisma.sql`r.company_id = ${companyId}`);
  for (const [child, parent] of Object.entries(details)) if (roots.has(parent)) {
    const tenant = transferModels[child].fields.some(field => field.name === 'company_id') ? Prisma.sql`r.company_id = ${companyId} AND` : Prisma.empty;
    await add(child, Prisma.sql`${tenant} ${selectedRef(parent, relationField(child, parent))}`);
  }
  if (contactParents.some(model => roots.has(model))) {
    // A shared contact is removed only when ALL its attached parents are selected.
    const refs = contactParents.map(parent => ({ parent, field: relationField('Contact', parent) }));
    await add('Contact', Prisma.sql`(${Prisma.join(refs.map(({ parent, field }) => selectedRef(parent, field)), ' OR ')}) AND ${Prisma.join(refs.map(({ parent, field }) => Prisma.sql`(r.${ident(field)} IS NULL OR ${selectedRef(parent, field)})`), ' AND ')}`);
    await add('ContactChannel', selectedRef('Contact', 'contact_id'));
  }
  if (junctions.some(model => models.includes(model))) {
    const existsLink = (model: string, selected: boolean) => Prisma.sql`EXISTS (SELECT 1 FROM ${table(model)} j WHERE j.address_id = r.id AND ${selected ? target(model, Prisma.sql`j.id`) : Prisma.sql`NOT ${target(model, Prisma.sql`j.id`)}`})`;
    await add('Address', Prisma.sql`(${Prisma.join(junctions.map(model => existsLink(model, true)), ' OR ')}) AND NOT (${Prisma.join(junctions.map(model => existsLink(model, false)), ' OR ')})`);
  }
  if (!roots.has('Document') && ['Property', 'Lease', 'Transaction'].some(model => roots.has(model))) {
    await add('Document', Prisma.sql`r.company_id = ${companyId} AND (${Prisma.join(['Property', 'Lease', 'Transaction'].map(parent => selectedRef(parent, relationField('Document', parent))), ' OR ')})`);
  }
  const counts = Object.fromEntries((await tx.$queryRaw<{ model: string; n: number }[]>`SELECT model, count(*)::int AS n FROM pg_temp.nairim_deletion_targets GROUP BY model`).map(row => [row.model, row.n]));
  const blockers = new Set<string>();
  for (const [source, meta] of Object.entries(transferModels)) {
    const affected = meta.relations.filter(rel => counts[rel.model] > 0);
    if (!affected.length) continue;
    const references = affected.map(rel => {
      if (rel.fields.length !== 1 || rel.references[0] !== 'id') throw new Error('Relação não suportada na exclusão.');
      return Prisma.sql`SELECT 1 AS n FROM ${table(source)} r JOIN pg_temp.nairim_deletion_targets t ON t.model = ${rel.model} AND t.id = r.${ident(rel.fields[0])} WHERE NOT ${target(source, ownId)}`;
    });
    const blocked = await tx.$queryRaw<{ n: number }[]>(Prisma.sql`${Prisma.join(references, ' UNION ALL ')} LIMIT 1`);
    if (blocked.length) blockers.add(`Há registros vinculados em ${label(source)}. Inclua esse grupo na seleção ou remova os vínculos antes de continuar.`);
  }
  return { company, counts, total: Object.values(counts).reduce((a, b) => a + b, 0), blockers: [...blockers], models };
}
function deletionOrder(models: string[]) {
  const ordered: string[] = [], visiting = new Set<string>();
  const visit = (model: string) => {
    if (ordered.includes(model) || visiting.has(model)) return;
    visiting.add(model);
    for (const rel of transferModels[model].relations) if (rel.model !== model && models.includes(rel.model)) visit(rel.model);
    ordered.push(model);
  };
  models.forEach(visit);
  return ordered.reverse();
}
export async function previewCompanyDataDeletion(companyId: string, groups: DeletionGroupKey[]) {
  return prisma.$transaction(async tx => {
    const result = await prepare(tx, companyId, groups);
    return { company: result.company, counts: result.counts, total: result.total, blockers: result.blockers };
  }, { timeout: 120000, isolationLevel: 'RepeatableRead' });
}
export async function deleteCompanyData(companyId: string, groups: DeletionGroupKey[]) {
  const actor = getAuditActor();
  if (!actor || actor.company_id !== companyId) throw new ForbiddenError('Contexto de auditoria inválido.');
  return prisma.$transaction(async tx => {
    const result = await prepare(tx, companyId, groups);
    if (result.blockers.length) throw new ValidationError(result.blockers.join(' '));
    for (const model of deletionOrder(result.models)) {
      await tx.$executeRaw(Prisma.sql`DELETE FROM ${table(model)} r WHERE ${target(model, ownId)}`);
    }
    await tx.auditLogOutbox.create({ data: {
      company_id: companyId, user_id: actor.id, user_name: actor.name, user_email: actor.email, ip: actor.ip,
      action: 'DELETE', table_name: 'CompanyData', record_id: companyId,
      old_values: { description: 'Exclusão permanente de dados operacionais da empresa', groups, record_counts: result.counts, record_count: result.total },
    } });
    return { company: result.company, counts: result.counts, total: result.total, blockers: result.blockers };
  }, { timeout: 120000, isolationLevel: 'Serializable' });
}
