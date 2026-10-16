import { Client } from 'pg';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Usage: node --env-file=.env scripts/audit-lease-cancellations.mjs
// Optional: --company=UUID --contract=4169/23 --details --output=.tmp-e2e/correcoes48/lease-audit.json
// No writes are permitted by PostgreSQL during this audit. Details are opt-in
// and contain identifiers only, never credentials, names or addresses.
const option = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const companyId = option('company') || null;
const contractNumber = option('contract') || '4169/23';
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
  query_timeout: 20000,
  application_name: 'nairim-readonly-lease-audit',
});

try {
  if (!process.env.DATABASE_URL) throw Object.assign(new Error(), { code: 'DATABASE_URL_MISSING' });
  await client.connect();
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await client.query("SET LOCAL statement_timeout = '15s'");
  const { rows: columns } = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'Transaction' AND column_name = 'canceled_at'");
  const hasCanceledMarker = columns.length > 0;
  const activeMarker = hasCanceledMarker ? 'AND t.canceled_at IS NULL' : '';
  const { rows: summary } = await client.query(`
    SELECT l.company_id,
      COUNT(*) FILTER (WHERE t.status = 'PENDING' AND t.effective_date >= l.canceled_at::date)::int AS pending_on_or_after_cancellation,
      COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'PENDING' AND t.effective_date >= l.canceled_at::date), 0)::text AS amount_on_or_after_cancellation,
      COUNT(*) FILTER (WHERE t.status = 'PENDING' AND t.effective_date < l.canceled_at::date)::int AS pending_before_cancellation,
      COUNT(*) FILTER (WHERE t.status = 'COMPLETED' AND t.effective_date >= l.canceled_at::date)::int AS settled_on_or_after_cancellation,
      COUNT(DISTINCT l.id) FILTER (WHERE l.canceled_at IS NULL)::int AS canceled_contract_without_cancellation_date
    FROM "Transaction" t JOIN "Lease" l ON l.id = t.lease_id AND l.company_id = t.company_id
    WHERE l.status = 'CANCELED' AND t.deleted_at IS NULL AND t.is_cancellation_charge = false
      ${activeMarker} AND ($1::text IS NULL OR l.company_id = $1)
    GROUP BY l.company_id ORDER BY l.company_id`, [companyId]);
  const { rows: citedContract } = await client.query(`
    SELECT l.company_id, l.contract_number, l.status::text AS contract_status,
      to_char(t.event_date, 'MM/YYYY') AS reference,
      COUNT(t.id)::int AS transactions,
      COUNT(t.id) FILTER (WHERE t.lease_id IS NULL)::int AS legacy_without_link,
      COUNT(*) FILTER (WHERE t.deleted_at IS NULL AND t.status = 'PENDING')::int AS active_pending,
      COUNT(*) FILTER (WHERE t.deleted_at IS NULL AND t.status = 'COMPLETED')::int AS active_settled,
      COUNT(*) FILTER (WHERE t.deleted_at IS NOT NULL)::int AS deleted
    FROM "Lease" l LEFT JOIN "Transaction" t ON t.company_id = l.company_id AND (
      t.lease_id = l.id OR (t.lease_id IS NULL AND
        (regexp_match(lower(t.description), 'contrato[[:space:]]+([[:alnum:]]+(/[[:alnum:]]+)*)'))[1] = lower(l.contract_number)
        AND 1 = (SELECT COUNT(*) FROM "Lease" candidate WHERE candidate.company_id = l.company_id
          AND candidate.deleted_at IS NULL AND lower(candidate.contract_number) = lower(l.contract_number))))
    WHERE l.contract_number = $2 AND ($1::text IS NULL OR l.company_id = $1)
    GROUP BY l.company_id, l.contract_number, l.status, to_char(t.event_date, 'MM/YYYY')
    ORDER BY l.company_id, reference`, [companyId, contractNumber]);
  const { rows: legacy } = await client.query(`
    WITH candidates AS (
      SELECT t.id, t.company_id, t.amount, t.status, t.effective_date,
        (regexp_match(lower(t.description), 'contrato[[:space:]]+([[:alnum:]]+(/[[:alnum:]]+)*)'))[1] AS contract_number
      FROM "Transaction" t
      WHERE t.lease_id IS NULL AND t.deleted_at IS NULL AND t.is_transfer = false
        AND ($1::text IS NULL OR t.company_id = $1)
    ), matched AS (
      SELECT t.id, t.company_id, t.amount, COUNT(l.id)::int AS matches,
        BOOL_OR(l.status = 'CANCELED' AND t.status = 'PENDING' AND t.effective_date >= l.canceled_at::date) AS pending_after_cancellation
      FROM candidates t JOIN "Lease" l ON l.company_id = t.company_id
        AND lower(l.contract_number) = t.contract_number AND l.deleted_at IS NULL
      GROUP BY t.id, t.company_id, t.amount
    )
    SELECT company_id, COUNT(*) FILTER (WHERE matches = 1)::int AS unambiguous_unlinked,
      COUNT(*) FILTER (WHERE matches > 1)::int AS ambiguous_unlinked,
      COUNT(*) FILTER (WHERE matches = 1 AND pending_after_cancellation)::int AS unlinked_pending_on_or_after_cancellation
    FROM matched GROUP BY company_id ORDER BY company_id`, [companyId]);
  const { rows: integrity } = await client.query(`
    SELECT COUNT(*)::int AS cross_company_lease_links
    FROM "Transaction" t JOIN "Lease" l ON l.id = t.lease_id
    WHERE t.company_id <> l.company_id AND ($1::text IS NULL OR t.company_id = $1)`, [companyId]);
  const { rows: overlaps } = await client.query(`
    WITH monthly AS (
      SELECT t.company_id, t.lease_id, date_trunc('month', t.event_date) AS month,
        CASE WHEN c.type = 'INCOME' AND lower(t.description) LIKE '%aluguel%' THEN 'rent'
          WHEN c.type = 'EXPENSE' AND lower(t.description) LIKE '%comiss%' THEN 'commission' END AS kind,
        BOOL_OR(t.installment_number IS NULL) AS has_manual,
        BOOL_OR(t.installment_number IS NOT NULL) AS has_generated
      FROM "Transaction" t JOIN "Category" c ON c.id = t.category_id AND c.company_id = t.company_id
      WHERE t.lease_id IS NOT NULL AND t.deleted_at IS NULL ${activeMarker}
        AND ($1::text IS NULL OR t.company_id = $1)
      GROUP BY t.company_id, t.lease_id, date_trunc('month', t.event_date),
        CASE WHEN c.type = 'INCOME' AND lower(t.description) LIKE '%aluguel%' THEN 'rent'
          WHEN c.type = 'EXPENSE' AND lower(t.description) LIKE '%comiss%' THEN 'commission' END
    ) SELECT company_id, COUNT(*)::int AS months_requiring_overlap_review
      FROM monthly WHERE kind IS NOT NULL AND has_manual AND has_generated GROUP BY company_id ORDER BY company_id`, [companyId]);
  const report = {
    auditedAt: new Date().toISOString(), readOnly: true, hasCanceledMarker,
    note: 'Pendências anteriores podem ser legítimas. Vencimentos posteriores exigem revisão, inclusive seleções intencionais do modal; nenhum registro foi alterado.',
    summary, citedContract, legacy, overlaps, integrity: integrity[0],
  };
  if (process.argv.includes('--details')) {
    report.details = (await client.query(`
      SELECT t.id AS transaction_id, l.id AS lease_id, l.company_id,
        to_char(t.event_date, 'MM/YYYY') AS reference, t.effective_date::text AS due_date, t.amount::text
      FROM "Transaction" t JOIN "Lease" l ON l.id = t.lease_id AND l.company_id = t.company_id
      WHERE l.status = 'CANCELED' AND t.deleted_at IS NULL AND t.status = 'PENDING'
        AND t.is_cancellation_charge = false AND t.effective_date >= l.canceled_at::date
        ${activeMarker} AND ($1::text IS NULL OR l.company_id = $1)
      ORDER BY t.effective_date, t.id LIMIT 200`, [companyId])).rows;
  }
  await client.query('ROLLBACK');
  const serialized = JSON.stringify(report, null, 2);
  const output = option('output');
  if (output) {
    const destination = path.resolve(output);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, serialized + '\n');
  }
  console.log(serialized);
} catch (error) {
  try { await client.query('ROLLBACK'); } catch { /* Connection may be unavailable. */ }
  const code = error.code ?? (/timeout|timed out/i.test(String(error.message)) ? 'CONNECTION_TIMEOUT' : 'AUDIT_FAILED');
  console.error(JSON.stringify({ readOnly: true, completed: false, code, message: 'Auditoria não concluída. Verifique a conexão e a versão do banco. Nenhum registro foi alterado.' }));
  process.exitCode = 1;
} finally {
  await client.end();
}
