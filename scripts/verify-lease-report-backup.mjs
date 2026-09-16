import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import assert from 'node:assert/strict';

// Executa o repositório real sobre uma cópia em memória do backup, sem conectar
// ou restaurar bancos. O arquivo e os resultados privados ficam fora do código.
const input = process.argv[2];
if (!input) throw new Error('Informe o caminho do backup JSON.');
const { data } = JSON.parse(await readFile(input, 'utf8'));
const root = process.cwd();
const output = path.join(root, '.tmp-e2e/lease-report');
await mkdir(output, { recursive: true });
const index = (values) => new Map(values.map((value) => [value.id, value]));
const properties = index(data.properties);
const agencies = index(data.agencies);
const tenants = index(data.tenants);
const categories = index(data.categories);
const subcategories = index(data.subcategories);
const leases = data.leases.filter((lease) => !lease.deleted_at).map((lease) => ({
  ...lease,
  start_date: new Date(lease.start_date), end_date: new Date(lease.end_date),
  canceled_at: lease.canceled_at ? new Date(lease.canceled_at) : null,
  agency: agencies.get(lease.agency_id), tenant: tenants.get(lease.tenant_id),
  property: { ...properties.get(lease.property_id), agency: agencies.get(properties.get(lease.property_id)?.agency_id) },
}));
globalThis.leaseReportBackupPrisma = {
  lease: { findMany: async () => leases },
  transaction: { findMany: async ({ where }) => data.transactions
    .filter((tx) => !tx.deleted_at && tx.status === where.status && !tx.is_transfer
      && new Date(tx.effective_date) >= where.effective_date.gte
      && new Date(tx.effective_date) <= where.effective_date.lte)
    .map((tx) => ({ ...tx, effective_date: new Date(tx.effective_date),
      category: categories.get(tx.category_id), subcategory: subcategories.get(tx.subcategory_id) })) },
};
const server = await createServer({
  configFile: false, root, server: { middlewareMode: true },
  resolve: { alias: { '@': path.join(root, 'src') } },
  plugins: [{ name: 'backup-memory-only', enforce: 'pre', load(id) {
    if (id.replaceAll('\\', '/').endsWith('/src/infra/database/prisma.ts')) {
      return 'export default globalThis.leaseReportBackupPrisma;';
    }
  } }],
});
try {
  const { PrismaLeaseReportsRepository } = await server.ssrLoadModule('/src/infra/repositories/prisma-lease-reports-repository.ts');
  const reports = [];
  for (let month = 3; month <= 7; month++) {
    const report = await new PrismaLeaseReportsRepository().getLeaseReport({ months: [{ year: 2026, month }] });
    for (const key of Object.keys(report.totals)) {
      const sum = Math.round(report.rows.reduce((total, row) => total + row[key], 0) * 100) / 100;
      assert.equal(report.totals[key], sum, `Total ${key}, mês ${month}`);
    }
    reports.push(report);
    console.log(JSON.stringify({ month, totals: report.totals, monthly: report.monthlyDarf,
      quarterly: report.quarterlyDarf, unmatched: report.unmatched }));
  }
  await writeFile(path.join(output, 'reconciliation.json'), JSON.stringify(reports, null, 2));
  console.log('Verificação concluída sem gravações no banco.');
} finally {
  delete globalThis.leaseReportBackupPrisma;
  await server.close();
}
