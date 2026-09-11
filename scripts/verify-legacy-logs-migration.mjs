import pg from 'pg';
import { MongoClient } from 'mongodb';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

// Disposable schema and Mongo database only; no user records are modified.
const name = 'logs_verify_' + randomUUID().replaceAll('-', '');
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
const mongo = new MongoClient(process.env.MONGODB_LOGS_URI);
await db.connect(); await mongo.connect();
try {
  await db.query(`CREATE SCHEMA "${name}"`);
  const { rows: tables } = await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ('AuditLog','AuditLogOutbox')");
  for (const { tablename } of tables) {
    const quoted = '"' + tablename.replaceAll('"','""') + '"';
    await db.query(`CREATE TABLE "${name}".${quoted} (LIKE public.${quoted} INCLUDING DEFAULTS)`);
  }
  await db.query(`SET search_path TO "${name}"`);
  await db.query(`CREATE TYPE "AuditAction" AS ENUM ('LOGIN','LOGIN_FAILED','CREATE','UPDATE','DELETE')`);
  const legacy = `CREATE TABLE "AuditLog" (id text PRIMARY KEY,company_id text,user_id text,user_name text,user_email text,
    action "AuditAction",table_name varchar(60),record_id text,old_values jsonb,new_values jsonb,ip varchar(45),created_at timestamp(3) DEFAULT CURRENT_TIMESTAMP)`;
  await db.query(legacy);
  await db.query(`INSERT INTO "Company" (id,name,slug,updated_at) VALUES ('test-a','Teste A','verify-a',now()),('test-b','Teste B','verify-b',now())`);
  await db.query(`INSERT INTO "AuditLog" (id,company_id,action,table_name,old_values,created_at)
    VALUES ('first','test-a','UPDATE','Company','{"value":1}','2020-01-01'),('second','test-b','CREATE','Company',null,'2020-02-01')`);
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('options', `-c search_path=${name}`);
  const run = () => spawnSync(process.execPath, ['scripts/export-and-drop-legacy-logs.mjs'], {
    env: { ...process.env, DATABASE_URL: url.toString(), MONGODB_LOGS_DATABASE: name }, encoding:'utf8', timeout:60000,
  });
  const first = run(); assert.equal(first.status,0,first.stderr + first.stdout);
  assert.equal((await db.query(`SELECT to_regclass('"AuditLog"') AS legacy`)).rows[0].legacy,null);
  assert.equal(await mongo.db(name).collection('audit_logs').countDocuments(),2);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM "AuditLogOutbox"')).rows[0].n,0);
  // New business writes still enter the queue after DROP.
  await db.query(`UPDATE "Company" SET name='Changed' WHERE id='test-a'`);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM "AuditLogOutbox"')).rows[0].n,1);
  const second = run(); assert.equal(second.status,0,second.stderr + second.stdout);
  assert.equal(await mongo.db(name).collection('audit_logs').countDocuments(),3);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM "AuditLogOutbox"')).rows[0].n,0);
  // A mismatched prior copy must prevent dropping the source.
  await db.query(legacy);
  await db.query(`INSERT INTO "AuditLog" (id,company_id,action,table_name,old_values) VALUES ('first','test-a','UPDATE','Company','{"value":999}')`);
  const conflict = run(); assert.notEqual(conflict.status,0);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM "AuditLog"')).rows[0].n,1);
  console.log('MIGRATION_OK: all tenants, verified copy, physical DROP, trigger continuity, repeat execution, conflict preserves source.');
} finally {
  // Targets are generated here, never supplied by external input.
  assert.match(name,/^logs_verify_[a-f0-9]{32}$/);
  await db.query('SET search_path TO public');
  await db.query(`DROP SCHEMA "${name}" CASCADE`);
  await mongo.db(name).dropDatabase();
  await db.end(); await mongo.close();
}
