import prisma from '@/infra/database/prisma';
import { assertSuperAdmin } from '@/infra/auth/session';
import { getAuditActor, runWithAuditActor } from '@/infra/database/audit-context';
import { runWithTenant } from '@/infra/database/tenant-context';
import { writeTransferAuditEvent } from '@/infra/database/audit-events';
import { tableTransferRepository } from '@/infra/repositories/prisma-table-transfer-repository';
import { ValidationError, ForbiddenError } from '@/core/errors/domain-errors';
import type { DecodedSessionToken } from '@/core/cryptography/token-signer';
import { TABLE_TRANSFER_MAX_BYTES, type TransferTable, type TableTransferImportMode, type TableTransferImportOutcome } from '@/shared/data/table-transfer';
import { parseTableTransfer, parseTableTransferBundle, type TableTransferPayload, type TableTransferBundle } from '@/shared/validators/table-transfer';

type Company = { id: string; name: string; slug: string };
type ImportJob = { company: Company; payload: TableTransferPayload };

function authorize(table: TransferTable, session: DecodedSessionToken) {
  assertSuperAdmin(session);
  if (table.global) throw new ValidationError('Este cadastro já abrange todas as empresas. Use a transferência padrão.');
  const actor = getAuditActor();
  if (!actor || actor.id !== session.id) throw new ForbiddenError('Autor da transferência não identificado.');
  return actor;
}
async function companies() {
  const rows = await prisma.company.findMany({ where: { deleted_at: null }, select: { id: true, name: true, slug: true }, orderBy: { id: 'asc' }, take: 1001 });
  if (!rows.length || rows.length > 1000) throw new ValidationError('A operação requer de 1 a 1.000 empresas cadastradas.');
  return rows;
}
function inCompany<T>(company: Company, session: DecodedSessionToken, fn: () => Promise<T>) {
  const actor = getAuditActor();
  if (!actor || actor.id !== session.id) throw new ForbiddenError('Autor da transferência não identificado.');
  return runWithTenant(company.id, () => runWithAuditActor({ ...actor, company_id: company.id }, fn));
}
// Bound simultaneous transactions so large installations do not exhaust the pool.
async function mapCompanies<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length); let next = 0; let failed = false; let failure: unknown;
  await Promise.all(Array.from({ length: Math.min(3, items.length) }, async () => {
    while (!failed && next < items.length) {
      const index = next++;
      try { results[index] = await fn(items[index]); } catch (error) { if (!failed) failure = error; failed = true; }
    }
  }));
  if (failed) throw failure;
  return results;
}
export async function exportAllTableData(table: TransferTable, session: DecodedSessionToken) {
  authorize(table, session);
  const targets = await companies();
  let records = 0; let bytes = 0;
  const entries = await mapCompanies(targets, async company => {
    const entry = { company, payload: await inCompany(company, session, () => tableTransferRepository.export(table, company.id, false)) };
    records += Object.values(entry.payload.meta.counts).reduce((sum, count) => sum + count, 0);
    bytes += Buffer.byteLength(JSON.stringify(entry, (_key, value) => typeof value === 'bigint' ? value.toString() : value), 'utf8');
    if (records > 100000 || bytes > TABLE_TRANSFER_MAX_BYTES) throw new ValidationError('O arquivo conjunto excede 40 MB ou 100.000 registros. Exporte as empresas individualmente.');
    return entry;
  });
  const recordCount = entries.reduce((sum, entry) => sum + Object.values(entry.payload.meta.counts).reduce((n, count) => n + count, 0), 0);
  const bundle: TableTransferBundle = { meta: { app: 'nairim', formatVersion: 2, table: table.key, scope: 'all', exportedAt: new Date().toISOString(), companyCount: entries.length, recordCount }, companies: entries };
  const json = JSON.stringify(bundle, (_key, value) => typeof value === 'bigint' ? value.toString() : value, 2);
  if (recordCount > 100000 || Buffer.byteLength(json, 'utf8') > TABLE_TRANSFER_MAX_BYTES) throw new ValidationError('O arquivo conjunto excede 40 MB ou 100.000 registros. Exporte as empresas individualmente.');
  // Only publish audit events after the complete file has been prepared.
  await prisma.$transaction(async tx => {
    for (const { company, payload } of entries) await inCompany(company, session, () => writeTransferAuditEvent(tx, {
      action: 'EXPORT', tableName: table.model, companyId: company.id, description: `Exportação conjunta de ${table.label}`, format: 'JSON',
      counts: payload.meta.counts, recordCount: Object.values(payload.meta.counts).reduce((sum, count) => sum + count, 0),
    }));
  }, { timeout: 60000 });
  return json;
}
async function importJobs(table: TransferTable, raw: unknown, mode: TableTransferImportMode): Promise<ImportJob[]> {
  const targets = await companies();
  if (mode === 'copy-all') {
    const { payload } = parseTableTransfer(raw, table.key);
    return targets.map(company => ({ company, payload }));
  }
  const bundle = parseTableTransferBundle(raw, table.key);
  const bySlug = new Map(targets.map(company => [company.slug, company]));
  const missing = bundle.companies.filter(entry => !bySlug.has(entry.company.slug));
  if (missing.length) throw new ValidationError(`Cadastre primeiro as empresas de destino com os mesmos identificadores (slug): ${missing.map(entry => entry.company.slug).join(', ')}. Nenhuma importação foi iniciada.`);
  return bundle.companies.map(entry => ({ company: bySlug.get(entry.company.slug)!, payload: entry.payload }));
}
export async function previewAllTableImport(table: TransferTable, raw: unknown, mode: TableTransferImportMode, session: DecodedSessionToken) {
  authorize(table, session);
  const jobs = await importJobs(table, raw, mode);
  const counts: Record<string, number> = {};
  for (const job of jobs) for (const [model, rows] of Object.entries(job.payload.data)) counts[model] = (counts[model] ?? 0) + rows.length;
  return { label: table.label, counts, total: Object.values(counts).reduce((sum, count) => sum + count, 0), dependencies: [...new Set(jobs.flatMap(job => job.payload.meta.dependencies))],
    mode, companyCount: jobs.length, companies: jobs.map(job => ({ name: job.company.name, slug: job.company.slug })) };
}
export async function importAllTableData(table: TransferTable, raw: unknown, mode: TableTransferImportMode, session: DecodedSessionToken) {
  authorize(table, session);
  // Resolve and validate the complete plan again; never trust a browser preview.
  const jobs = await importJobs(table, raw, mode);
  const results = await mapCompanies(jobs, async ({ company, payload }): Promise<TableTransferImportOutcome> => {
    try {
      const result = await inCompany(company, session, () => tableTransferRepository.import(table, payload, company.id, session.id, true));
      return { company: company.name, slug: company.slug, ok: true, ...result };
    } catch (error) {
      return { company: company.name, slug: company.slug, ok: false, created: 0, updated: 0, error: error instanceof ValidationError || error instanceof ForbiddenError ? error.message : 'Não foi possível importar nesta empresa. Nenhum registro desta importação foi gravado.' };
    }
  });
  return { created: results.reduce((sum, row) => sum + row.created, 0), updated: results.reduce((sum, row) => sum + row.updated, 0), results };
}
