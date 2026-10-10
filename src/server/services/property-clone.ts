import { randomUUID } from 'node:crypto';
import prisma from '@/infra/database/prisma';
import { listAccessibleCompanies } from '@/infra/auth/company-access';
import { getAuditActor, runWithAuditActor } from '@/infra/database/audit-context';
import { runWithTenant } from '@/infra/database/tenant-context';
import { minioStorage } from '@/infra/storage/minio-storage';
import { transferModels } from '@/shared/validators/table-transfer';
import { normalizeReportText } from '@/core/entities/lease-report-matching';
import { ForbiddenError, NotFoundError, ValidationError } from '@/core/errors/domain-errors';
import type { DecodedSessionToken } from '@/core/cryptography/token-signer';

type Row = Record<string, unknown>;
interface Delegate {
  findMany(args: { where: Row }): Promise<Row[]>;
  create(args: { data: Row }): Promise<Row>;
}
function delegate(client: object, model: string) {
  return (client as Record<string, Delegate>)[model[0].toLowerCase() + model.slice(1)];
}
const relations: Record<string, string> = { owner_id: 'Owner', type_id: 'PropertyType', agency_id: 'Agency',
  center_id: 'Center', debit_center_id: 'Center', category_id: 'Category', subcategory_id: 'Subcategory',
  iptu_refund_category_id: 'Category', iptu_refund_subcategory_id: 'Subcategory' };
const identityFields: Record<string, string[]> = { Owner: ['name'], PropertyType: ['description'], Agency: ['trade_name'],
  Center: ['name', 'type'], Category: ['name', 'type'], Subcategory: ['name', 'category_id'] };
function scalars(model: string, row: Row): Row {
  const excluded = new Set(['id', 'company_id', 'created_at', 'updated_at', 'deleted_at']);
  return Object.fromEntries(transferModels[model].fields.filter(field => !excluded.has(field.name) && field.name in row)
    .map(field => [field.name, row[field.name]]));
}
export async function propertyCloneCompanies(session: DecodedSessionToken) {
  const companies = await listAccessibleCompanies(session.id);
  return companies.map(({ id, name }) => ({ id, name }));
}
export async function cloneProperties(propertyIds: string[], companyIds: string[], session: DecodedSessionToken) {
  const accessible = await propertyCloneCompanies(session);
  if (!companyIds.length || companyIds.some(id => !accessible.some(company => company.id === id))) throw new ForbiddenError('Selecione somente empresas às quais você tem acesso.');
  const targets = accessible.filter(company => companyIds.includes(company.id));
  const actor = getAuditActor();
  if (!actor || actor.id !== session.id) throw new ForbiddenError('Contexto de auditoria não identificado.');
  const sources = await prisma.property.findMany({ where: { id: { in: propertyIds }, company_id: session.company_id, deleted_at: null },
    include: { addresses: { where: { deleted_at: null }, include: { address: true } }, values: { where: { deleted_at: null } },
      iptus: { where: { deleted_at: null } }, documents: { where: { deleted_at: null } } } });
  if (sources.length !== propertyIds.length) throw new NotFoundError('Um dos imóveis selecionados não foi encontrado nesta empresa.');
  // Resolve all source references once; no cross-company IDs are used in a copy.
  const parents = new Map<string, Map<string, Row>>();
  for (const model of [...new Set(Object.values(relations))]) {
    const ids = [...new Set(sources.flatMap(source => Object.entries(relations).filter(([, target]) => target === model)
      .flatMap(([field]) => source[field as keyof typeof source] ? [String(source[field as keyof typeof source])] : [])))];
    const rows = ids.length ? await delegate(prisma, model).findMany({ where: { id: { in: ids }, company_id: session.company_id, deleted_at: null } }) : [];
    if (rows.length !== ids.length) throw new ValidationError('Um cadastro relacionado ao imóvel foi excluído. Corrija o cadastro antes de duplicar.');
    parents.set(model, new Map(rows.map(row => [String(row.id), row])));
  }
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const [model, rows] of parents) for (const relation of transferModels[model].relations) {
      if (!parents.has(relation.model)) continue;
      const field = relation.fields[0]; const target = parents.get(relation.model)!;
      const missing = [...new Set([...rows.values()].flatMap(row => row[field] && !target.has(String(row[field])) ? [String(row[field])] : []))];
      if (!missing.length) continue;
      const loaded = await delegate(prisma, relation.model).findMany({ where: { id: { in: missing }, company_id: session.company_id, deleted_at: null } });
      if (loaded.length !== missing.length) throw new ValidationError('Um cadastro relacionado ao imóvel foi excluído. Corrija o cadastro antes de duplicar.');
      for (const row of loaded) target.set(String(row.id), row); expanded = true;
    }
  }
  const jobs = targets.flatMap(company => sources.map(source => ({ company, source })));
  const results: { company: string; property: string; ok: boolean; error?: string }[] = new Array(jobs.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(3, jobs.length) }, async () => {
    while (next < jobs.length) {
      const index = next++; const { company, source } = jobs[index]; const propertyId = randomUUID(); const copiedFiles: string[] = [];
      try {
        for (const document of source.documents) copiedFiles.push(await minioStorage.copy(document.file_path, `properties/${propertyId}`));
        await runWithTenant(company.id, () => runWithAuditActor({ ...actor, company_id: company.id }, () => prisma.$transaction(async tx => {
          // Serialize reference creation in this company across concurrent clone requests.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${company.id}), hashtext('property-clone'))`;
          const createdIds: string[] = [];
          const createRecord = async (model: string, data: Row) => {
            const created = await delegate(tx, model).create({ data }); createdIds.push(String(created.id)); return created;
          };
          const mapped = new Map<string, string>();
          const destinationRows = new Map<string, Row[]>();
          const resolveReference = async (model: string, sourceId: string): Promise<string> => {
            if (company.id === session.company_id) return sourceId;
            const key = `${model}:${sourceId}`; if (mapped.has(key)) return mapped.get(key)!;
            const original = parents.get(model)?.get(sourceId);
            if (!original) throw new ValidationError(`Cadastro relacionado ${model} indisponível.`);
            const data = scalars(model, original);
            for (const relation of transferModels[model].relations) if (parents.has(relation.model)) {
              const field = relation.fields[0]; if (data[field]) data[field] = await resolveReference(relation.model, String(data[field]));
            }
            if (!destinationRows.has(model)) destinationRows.set(model, await delegate(tx, model).findMany({ where: { company_id: company.id, deleted_at: null } }));
            const candidates = destinationRows.get(model)!;
            const document = String(original.cpf || original.cnpj || '').replace(/\D/g, '');
            const matches = candidates.filter(row => model === 'Owner' && document
              ? String(row.cpf || row.cnpj || '').replace(/\D/g, '') === document
              : identityFields[model].every(field => normalizeReportText(String(row[field] ?? '')) === normalizeReportText(String(data[field] ?? ''))));
            if (matches.length > 1) throw new ValidationError(`Há mais de um cadastro equivalente de ${String(data.name ?? data.description ?? data.trade_name)} na empresa. Ajuste os cadastros antes de duplicar.`);
            const found = matches[0] ?? await createRecord(model, { ...data, company_id: company.id });
            if (!matches.length) candidates.push(found);
            mapped.set(key, String(found.id)); return String(found.id);
          };
          const propertyData = scalars('Property', source as unknown as Row);
          for (const [field, model] of Object.entries(relations)) if (propertyData[field]) propertyData[field] = await resolveReference(model, String(propertyData[field]));
          await createRecord('Property', { ...propertyData, id: propertyId, company_id: company.id, title: `${source.title.replace(/ \(cópia\)$/, '')} (cópia)` });
          for (const link of source.addresses) {
            const address = await createRecord('Address', scalars('Address', link.address as unknown as Row));
            await createRecord('PropertyAddress', { property_id: propertyId, address_id: address.id });
          }
          for (const [model, rows] of [['PropertyValue', source.values], ['PropertyIptu', source.iptus]] as const)
            for (const row of rows) await createRecord(model, { ...scalars(model, row as unknown as Row), property_id: propertyId });
          for (const [index, doc] of source.documents.entries()) await createRecord('Document', { ...scalars('Document', doc as unknown as Row),
            company_id: company.id, property_id: propertyId, lease_id: null, transaction_id: null, created_by: session.id, file_path: copiedFiles[index] });
          // The legacy SQL trigger marks actors from another company as System.
          // Attribute only records created by this authorized operation to its actual actor.
          await tx.auditLogOutbox.updateMany({ where: { company_id: company.id, record_id: { in: createdIds }, action: 'CREATE', user_id: null },
            data: { user_id: actor.id, user_name: actor.name, user_email: actor.email, ip: actor.ip } });
        }, { timeout: 60000 })));
        results[index] = { company: company.name, property: source.title, ok: true };
      } catch (error) {
        await Promise.allSettled(copiedFiles.map(url => minioStorage.delete(url)));
        results[index] = { company: company.name, property: source.title, ok: false, error: error instanceof ValidationError ? error.message : 'Não foi possível duplicar o imóvel nesta empresa. Nenhuma alteração foi gravada.' };
      }
    }
  }));
  return results;
}
