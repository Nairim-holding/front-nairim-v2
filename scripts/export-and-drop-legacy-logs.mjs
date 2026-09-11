import fs from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';
import { MongoClient } from 'mongodb';
import { LOGS_LOCK } from '../worker/logs/transfer.mjs';
import { copyVerified } from '../worker/logs/copy-verified.mjs';

// This command intentionally migrates every company. It is an operator command,
// never an HTTP endpoint. DATABASE_URL and MONGODB_LOGS_* come from the chosen env file.
for (const key of ['DATABASE_URL', 'MONGODB_LOGS_URI', 'MONGODB_LOGS_DATABASE']) {
  if (!process.env[key]) throw new Error(`Configure ${key}.`);
}
pg.types.setTypeParser(1114, value => new Date(value.replace(' ', 'T') + 'Z'));
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
const mongo = new MongoClient(process.env.MONGODB_LOGS_URI, { serverSelectionTimeoutMS: 10000 });
let transaction = false;
try {
  await db.connect(); await mongo.connect();
  const logs = mongo.db(process.env.MONGODB_LOGS_DATABASE).collection('audit_logs');
  await logs.createIndex({ company_id: 1, created_at: -1, id: -1 });
  await db.query('BEGIN'); transaction = true;
  await db.query("SET LOCAL lock_timeout = '15s'");
  await db.query('SELECT pg_advisory_xact_lock($1)', [LOGS_LOCK]);
  const { rows: [tables] } = await db.query(`SELECT to_regclass('"AuditLog"') AS legacy, to_regclass('"AuditLogOutbox"') AS queue`);
  let migrated = 0;
  if (tables.legacy) {
    // Block old writers before counting/copying: nothing can arrive between verification and DROP.
    await db.query('LOCK TABLE "AuditLog" IN ACCESS EXCLUSIVE MODE');
    const { rows: [total] } = await db.query('SELECT count(*)::int AS n FROM "AuditLog"');
    let lastId = '';
    while (true) {
      const { rows } = await db.query(`SELECT q.*, CASE WHEN c.id IS NULL THEN NULL ELSE json_build_object('id',c.id,'name',c.name) END AS company
        FROM "AuditLog" q LEFT JOIN "Company" c ON c.id=q.company_id WHERE q.id > $1 ORDER BY q.id LIMIT 500`, [lastId]);
      if (!rows.length) break;
      await copyVerified(logs, rows);
      migrated += rows.length; lastId = rows.at(-1).id;
      console.log(`Histórico conferido: ${migrated}/${total.n}`);
    }
    if (migrated !== total.n) throw new Error('A contagem não confere; tabela antiga preservada.');
    if (!tables.queue) {
      // LIKE does not copy foreign keys: actor snapshots survive user deletion.
      await db.query('CREATE TABLE "AuditLogOutbox" (LIKE "AuditLog" INCLUDING DEFAULTS INCLUDING INDEXES)');
    }
    const auditName = '20260908000000_restore_audit_trail';
    const moveName = '20260911000000_move_logs_to_mongodb';
    const auditSql = fs.readFileSync(`prisma/migrations/${auditName}/migration.sql`, 'utf8');
    // Install/redirect all business triggers, including nested/bulk writes, before removing the old table.
    const triggers = auditSql.slice(auditSql.indexOf('CREATE OR REPLACE FUNCTION nairim_audit_snapshot'), auditSql.lastIndexOf('CREATE INDEX IF NOT EXISTS'))
      .replaceAll('INSERT INTO "AuditLog"', 'INSERT INTO "AuditLogOutbox"')
      .replaceAll('CREATE TRIGGER nairim_audit_changes', 'CREATE OR REPLACE TRIGGER nairim_audit_changes');
    await db.query(triggers);
    // RESTRICT is intentional: unknown dependencies stop the command rather than being removed.
    await db.query('DROP TABLE "AuditLog" RESTRICT');
    for (const name of [auditName, moveName]) {
      const { rows } = await db.query('SELECT finished_at,rolled_back_at FROM _prisma_migrations WHERE migration_name=$1', [name]);
      if (rows.some(row => row.finished_at)) continue;
      if (rows.some(row => !row.rolled_back_at)) throw new Error(`Resolva a migração pendente ${name}.`);
      const checksum = createHash('sha256').update(fs.readFileSync(`prisma/migrations/${name}/migration.sql`)).digest('hex');
      await db.query(`INSERT INTO _prisma_migrations (id,checksum,finished_at,migration_name,started_at,applied_steps_count)
        VALUES ($1,$2,now(),$3,now(),1)`, [randomUUID(), checksum, name]);
    }
  } else if (!tables.queue) {
    throw new Error('Não foi encontrada AuditLog nem AuditLogOutbox no banco configurado.');
  } else console.log('A tabela antiga AuditLog já foi removida. Conferindo entregas pendentes.');
  await db.query('COMMIT'); transaction = false;
  if (tables.legacy) console.log(`Tabela AuditLog removida após conferir ${migrated} logs no MongoDB.`);

  // Also handles installations migrated by the earlier rename-based procedure.
  let delivered = 0;
  while (true) {
    await db.query('BEGIN'); transaction = true;
    await db.query("SET LOCAL lock_timeout = '15s'");
    await db.query('SELECT pg_advisory_xact_lock($1)', [LOGS_LOCK]);
    const { rows } = await db.query(`SELECT q.*, CASE WHEN c.id IS NULL THEN NULL ELSE json_build_object('id',c.id,'name',c.name) END AS company
      FROM "AuditLogOutbox" q LEFT JOIN "Company" c ON c.id=q.company_id ORDER BY q.created_at,q.id LIMIT 500 FOR UPDATE OF q`);
    await copyVerified(logs, rows);
    if (rows.length) await db.query('DELETE FROM "AuditLogOutbox" WHERE id=ANY($1::text[])', [rows.map(row => row.id)]);
    await db.query('COMMIT'); transaction = false;
    delivered += rows.length;
    if (!rows.length) break;
  }
  console.log(`Concluído. ${migrated} logs históricos e ${delivered} pendentes conferidos. Fila temporária preservada para novas entregas.`);
} catch (error) {
  if (transaction) await db.query('ROLLBACK');
  console.error('Migração interrompida:', error.message);
  process.exitCode = 1;
} finally { await db.end(); await mongo.close(); }
