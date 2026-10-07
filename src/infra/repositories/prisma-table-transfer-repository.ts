import { createHash } from 'node:crypto';
import prisma from '@/infra/database/prisma';
import { writeTransferAuditEvent } from '@/infra/database/audit-events';
import { Prisma } from '@/generated/prisma/client';
import { ForbiddenError, ValidationError } from '@/core/errors/domain-errors';
import { TABLE_TRANSFER_FORMAT_VERSION, type TransferTable } from '@/shared/data/table-transfer';
import { transferModels, type TableTransferPayload, type TransferRows } from '@/shared/validators/table-transfer';

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;
interface Delegate {
  findMany(args: { where: Where; orderBy?: { id: 'asc' }; take?: number }): Promise<Row[]>;
  findFirst(args: { where: Where }): Promise<Row | null>;
  create(args: { data: Row }): Promise<unknown>;
  update(args: { where: Where; data: Row }): Promise<unknown>;
}
function delegate(client: object, model: string): Delegate {
  const key = model[0].toLowerCase() + model.slice(1);
  return (client as Record<string, Delegate>)[key];
}
const parentScopes: Record<string, string> = {
  AgencyAddress: 'agency', PropertyAddress: 'property', OwnerAddress: 'owner', TenantAddress: 'tenant', SupplierAddress: 'supplier',
  PropertyValue: 'property', PropertyIptu: 'property', PlanningMonth: 'planning',
  InvestmentTransaction: 'investment', InvestmentMonthBalance: 'investment', AdjustmentIndexValue: 'adjustment_index',
};
const contactScope = (companyId: string) => ({ OR: ['agency', 'owner', 'tenant', 'supplier'].map(parent => ({ [parent]: { company_id: companyId } })) });
function scope(model: string, companyId: string, exclusiveAddress = false): Where {
  if (transferModels[model].fields.some(field => field.name === 'company_id')) return { company_id: companyId };
  if (model === 'Company') return { id: companyId };
  if (parentScopes[model]) return { [parentScopes[model]]: { company_id: companyId } };
  if (model === 'Contact') return contactScope(companyId);
  if (model === 'ContactChannel') return { contact: contactScope(companyId) };
  if (model === 'Address') {
    const links = Object.entries({ agencyAddresses: 'agency', propertyAddresses: 'property', ownerAddresses: 'owner', tenantAddresses: 'tenant', supplierAddresses: 'supplier' });
    const owned = { OR: links.map(([relation, parent]) => ({ [relation]: { some: { [parent]: { company_id: companyId } } } })) };
    if (!exclusiveAddress) return owned;
    return { AND: [
      owned,
      { NOT: { OR: links.map(([relation, parent]) => ({ [relation]: { some: { [parent]: { company_id: { not: companyId } } } } })) } },
    ] };
  }
  throw new ValidationError(`Escopo não definido para ${model}.`);
}
const ids = (rows: Row[] = []) => rows.map(row => String(row.id));
function childFilter(model: string, table: TransferTable, data: TransferRows): Where {
  if (model === 'InvestmentSettings') return {};
  if (model === 'ContactChannel') return { contact_id: { in: ids(data.Contact) } };
  const relation = transferModels[model].relations.find(rel => rel.model === table.model);
  if (!relation || relation.fields.length !== 1) throw new ValidationError(`Relação de ${model} não definida.`);
  return { [relation.fields[0]]: { in: ids(data[table.model]) } };
}
function dependencies(table: TransferTable) {
  const owned = new Set([table.model, ...table.children, 'Company']);
  return [...new Set([table.model, ...table.children].flatMap(model => transferModels[model].relations.map(rel => rel.model)).filter(model => !owned.has(model)))];
}
function orderModels(models: string[]) {
  const ordered: string[] = [];
  const visiting = new Set<string>();
  const visit = (model: string) => {
    if (ordered.includes(model) || visiting.has(model)) return;
    visiting.add(model);
    for (const rel of transferModels[model].relations) if (rel.model !== model && models.includes(rel.model)) visit(rel.model);
    ordered.push(model);
  };
  models.forEach(visit);
  return ordered;
}

// Stable IDs keep copies in different companies separate and make repeated imports update.
export function tableTransferCopyId(companyId: string, model: string, id: string): string {
  const hex = createHash('sha256').update(JSON.stringify(['table-copy-v1', companyId, model, id])).digest('hex').slice(0, 32).split('');
  hex[12] = '8';
  hex[16] = ((parseInt(hex[16], 16) & 3) | 8).toString(16);
  const value = hex.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}
async function remapCompanyCopy(tx: object, data: TransferRows, companyId: string) {
  const mappings = new Map<string, Map<string, string>>();
  for (const [model, rows] of Object.entries(data)) {
    // Reuse IDs already imported by the previous version, only within this company.
    const owned = new Set(ids(await delegate(tx, model).findMany({ where: { ...scope(model, companyId, true), id: { in: ids(rows) } } })));
    mappings.set(model, new Map(rows.map(row => [String(row.id), owned.has(String(row.id)) ? String(row.id) : tableTransferCopyId(companyId, model, String(row.id))])));
  }
  for (const [model, rows] of Object.entries(data)) for (const row of rows) {
    row.id = mappings.get(model)!.get(String(row.id))!;
    for (const relation of transferModels[model].relations) {
      if (relation.model === 'Company' || ['created_by', 'updated_by'].includes(relation.fields[0])) continue;
      const value = row[relation.fields[0]];
      if (value != null && mappings.get(relation.model)?.has(String(value))) row[relation.fields[0]] = mappings.get(relation.model)!.get(String(value))!;
    }
  }
}
export class PrismaTableTransferRepository {
  async export(table: TransferTable, companyId: string, audit = true): Promise<TableTransferPayload> {
    return prisma.$transaction(async tx => {
      const data: TransferRows = {};
      const readLimit = audit ? {} : { take: 100001 };
      const checkReadLimit = () => { if (!audit && Object.values(data).reduce((sum, rows) => sum + rows.length, 0) > 100000) throw new ValidationError('O arquivo conjunto excede 100.000 registros. Exporte as empresas individualmente.'); };
      data[table.model] = await delegate(tx, table.model).findMany({ where: table.global ? {} : scope(table.model, companyId), orderBy: { id: 'asc' }, ...readLimit });
      checkReadLimit();
      for (const model of table.children.filter(model => model !== 'Address')) {
        data[model] = await delegate(tx, model).findMany({ where: { ...(table.global ? {} : scope(model, companyId)), ...childFilter(model, table, data) }, orderBy: { id: 'asc' }, ...readLimit });
        checkReadLimit();
      }
      if (table.children.includes('Address')) {
        const addressIds = [...new Set(Object.entries(data).filter(([model]) => model.endsWith('Address')).flatMap(([, rows]) => rows.map(row => String(row.address_id))))];
        data.Address = await delegate(tx, 'Address').findMany({ where: { ...scope('Address', companyId), id: { in: addressIds } }, orderBy: { id: 'asc' }, ...readLimit });
      }
      checkReadLimit();
      const counts = Object.fromEntries(Object.entries(data).map(([model, rows]) => [model, rows.length]));
      if (audit) await writeTransferAuditEvent(tx, {
        action: 'EXPORT', tableName: table.model, companyId,
        description: `Exportação de ${table.label}`, format: 'JSON', counts,
        recordCount: Object.values(counts).reduce((sum, count) => sum + count, 0),
      });
      return { meta: { app: 'nairim', formatVersion: TABLE_TRANSFER_FORMAT_VERSION, table: table.key, company_id: companyId, exportedAt: new Date().toISOString(), counts, dependencies: dependencies(table) }, data };
    }, { isolationLevel: 'RepeatableRead', timeout: 60000 });
  }

  async import(table: TransferTable, payload: TableTransferPayload, companyId: string, actorId: string, superAdmin: boolean) {
    const data: TransferRows = structuredClone(payload.data);
    const copyingCompany = !table.global && !!payload.meta?.company_id && payload.meta.company_id !== companyId;
    const rootIds = new Set(ids(data[table.model]));
    // Child rows cannot be used to edit unrelated cadastros using the root's permission.
    for (const [model, rows] of Object.entries(data)) {
      if (model === table.model || model === 'Address' || model === 'InvestmentSettings') continue;
      const target = model === 'ContactChannel' ? 'Contact' : table.model;
      const relation = transferModels[model].relations.find(rel => rel.model === target)!;
      const parentIds = target === table.model ? rootIds : new Set(ids(data[target]));
      if (rows.some(row => !parentIds.has(String(row[relation.fields[0]])))) throw new ValidationError(`Há registros de ${model} fora do cadastro importado.`);
    }
    const linkedAddresses = new Set(Object.entries(data).filter(([model]) => model.endsWith('Address')).flatMap(([, rows]) => rows.map(row => String(row.address_id))));
    if ((data.Address ?? []).some(row => !linkedAddresses.has(String(row.id)))) throw new ValidationError('O arquivo contém endereços sem vínculo com o cadastro importado.');
    // Replace source company and author references. Copy IDs are resolved in the transaction.
    for (const [model, rows] of Object.entries(data)) for (const row of rows) {
      if (!table.global && transferModels[model].fields.some(field => field.name === 'company_id')) row.company_id = companyId;
      for (const rel of transferModels[model].relations) {
        if (rel.model === 'User' && ['created_by', 'updated_by'].includes(rel.fields[0])) row[rel.fields[0]] = actorId;
      }
      if (model === 'User') {
        if (row.role === 'SUPER_ADMIN' && !superAdmin) throw new ForbiddenError('Somente um super administrador pode importar usuários com este papel.');
        row.all_companies_access = false;
        row.allowed_company_ids = [];
      }
    }
    return prisma.$transaction(async tx => {
      if (copyingCompany) await remapCompanyCopy(tx, data, companyId);
      const existing: Record<string, Set<string>> = {};
      // Check ownership before writes. Explicit scopes also protect child tables.
      for (const [model, rows] of Object.entries(data)) {
        const found = await delegate(tx, model).findMany({ where: { ...(table.global ? {} : scope(model, companyId, true)), id: { in: ids(rows) } } });
        if (model === 'User' && !superAdmin && found.some(row => row.role === 'SUPER_ADMIN')) throw new ForbiddenError('Não é permitido alterar um super administrador por importação.');
        if (model !== table.model && model !== 'Address' && model !== 'InvestmentSettings') {
          const target = model === 'ContactChannel' ? 'Contact' : table.model;
          const relation = transferModels[model].relations.find(rel => rel.model === target)!;
          const parentIds = new Set(ids(data[target]));
          if (found.some(row => !parentIds.has(String(row[relation.fields[0]]))))
            throw new ValidationError(`Um ID de ${model} já pertence a outro registro no destino.`);
        }
        existing[model] = new Set(ids(found));
      }
      // Validate all foreign keys against this file or scoped records in the destination.
      const checked = new Map<string, unknown>();
      for (const [model, rows] of Object.entries(data)) for (const row of rows) {
        for (const rel of transferModels[model].relations) {
          const value = row[rel.fields[0]];
          if (value == null) continue;
          const reference = `${rel.model}:${value}`;
          if (checked.has(reference)) { row[rel.fields[0]] = checked.get(reference); continue; }
          if ((data[rel.model] ?? []).some(parent => parent[rel.references[0]] === value)) continue;
          if (rel.model === 'User' && ['created_by', 'updated_by'].includes(rel.fields[0]) && value === actorId) continue;
          let found = await delegate(tx, rel.model).findFirst({ where: { ...(table.global ? {} : scope(rel.model, companyId)), [rel.references[0]]: value } });
          if (!found && copyingCompany && rel.model !== 'Company' && rel.references[0] === 'id') {
            const copiedId = tableTransferCopyId(companyId, rel.model, String(value));
            found = await delegate(tx, rel.model).findFirst({ where: { ...scope(rel.model, companyId), id: copiedId } });
            if (found) row[rel.fields[0]] = copiedId;
          }
          if (!found) throw new ValidationError(`${model}: importe primeiro o cadastro ${rel.model} (registro ${value}). O vínculo está ausente ou pertence a outra empresa.`);
          checked.set(reference, row[rel.fields[0]]);
        }
      }
      const deferred: { model: string; id: string; field: string; value: unknown }[] = [];
      let created = 0; let updated = 0;
      for (const model of orderModels(Object.keys(data))) for (const row of data[model]) {
        const record: Row = { ...row };
        // Nullable self references (e.g. transaction parents) are linked after all rows exist.
        for (const rel of transferModels[model].relations.filter(rel => rel.model === model)) {
          const field = rel.fields[0];
          if (record[field] != null && transferModels[model].fields.find(f => f.name === field)?.nullable) {
            deferred.push({ model, id: String(row.id), field, value: record[field] }); record[field] = null;
          }
        }
        for (const field of transferModels[model].fields) {
          if (record[field.name] != null && field.type === 'DateTime') record[field.name] = new Date(String(record[field.name]));
          if (record[field.name] != null && field.type === 'BigInt') record[field.name] = BigInt(String(record[field.name]));
          if (record[field.name] === null && field.type === 'Json') record[field.name] = Prisma.DbNull;
        }
        // A separate create avoids upserting an ID hidden by the tenant scope.
        if (existing[model].has(String(row.id))) {
          const values = { ...record }; delete values.id;
          await delegate(tx, model).update({ where: { ...(table.global ? {} : scope(model, companyId, true)), id: row.id }, data: values }); updated++;
        } else {
          // Settings have a unique company ID; an environment may already have a row.
          const settings = model === 'InvestmentSettings' ? await delegate(tx, model).findFirst({ where: { company_id: companyId } }) : null;
          if (settings) {
            const values = { ...record }; delete values.id;
            await delegate(tx, model).update({ where: { id: settings.id, company_id: companyId }, data: values }); updated++;
          } else { await delegate(tx, model).create({ data: record }); created++; }
        }
      }
      for (const ref of deferred) await delegate(tx, ref.model).update({ where: { id: ref.id, ...(table.global ? {} : scope(ref.model, companyId)) }, data: { [ref.field]: ref.value } });
      await writeTransferAuditEvent(tx, {
        action: 'IMPORT', tableName: table.model, companyId,
        description: `Importação de ${table.label}`, format: 'JSON', created, updated,
        counts: Object.fromEntries(Object.entries(data).map(([model, rows]) => [model, rows.length])),
        recordCount: created + updated,
      });
      return { created, updated };
    }, { timeout: 120000, isolationLevel: 'Serializable' }).catch(error => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2003', 'P2025'].includes(error.code))
        throw new ValidationError('Importação cancelada: há IDs ou chaves únicas em conflito, ou vínculos indisponíveis no destino. Nenhum registro foi gravado.');
      throw error;
    });
  }
}
export const tableTransferRepository = new PrismaTableTransferRepository();
