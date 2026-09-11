import fs from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';

// Applies only the audit migrations, without touching unrelated pending migrations.
const migrations = ['20260908000000_restore_audit_trail', '20260911000000_move_logs_to_mongodb'];
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query('BEGIN');
  await client.query("SET LOCAL lock_timeout = '10s'");
  for (const name of migrations) {
    const existing = await client.query('SELECT finished_at, rolled_back_at FROM _prisma_migrations WHERE migration_name=$1', [name]);
    if (existing.rows.some(row => row.finished_at)) continue;
    if (existing.rows.some(row => !row.rolled_back_at)) throw new Error(`Resolve the failed migration first: ${name}`);
    const sql = fs.readFileSync(`prisma/migrations/${name}/migration.sql`, 'utf8');
    await client.query(sql.replace(/^BEGIN;\s*$/m, '').replace(/^COMMIT;\s*$/m, ''));
    await client.query(`INSERT INTO _prisma_migrations (id,checksum,finished_at,migration_name,started_at,applied_steps_count)
      VALUES ($1,$2,now(),$3,now(),1)`, [randomUUID(), createHash('sha256').update(sql).digest('hex'), name]);
    console.log(`Validated: ${name}`);
  }
  console.log((await client.query('SELECT count(*)::int AS preserved_logs FROM "AuditLogOutbox"')).rows[0]);
  await client.query(process.argv.includes('--apply') ? 'COMMIT' : 'ROLLBACK');
  console.log(process.argv.includes('--apply') ? 'Audit migrations applied.' : 'Dry run successful; all changes rolled back.');
} catch (error) {
  await client.query('ROLLBACK');
  console.error('Audit migration failed:', error.message);
  process.exitCode = 1;
} finally { await client.end(); }
