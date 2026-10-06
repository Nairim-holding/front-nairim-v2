import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { bootstrap, readBootstrapConfig } from './bootstrap.mjs';
import { assertDatabaseTarget, loadInitialSchema, initializeDatabase } from './init-database.mjs';

// PostgreSQL embarcado ja presente no lockfile via Prisma. Nao conecta em
// bancos externos. Valida SQL, constraints, triggers e cadastro inicial juntos.
test('banco vazio recebe schema atual, auditoria e administrador autenticavel', async () => {
  const db = new PGlite();
  const server = new PGLiteSocketServer({ db, port: 0, host: '127.0.0.1' });
  let client;
  try {
    const schemaSql = execFileSync(process.execPath, [
      'node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-empty',
      '--to-schema', 'prisma/schema.prisma', '--script',
    ], { encoding: 'utf8', env: { ...process.env, DATABASE_URL: 'postgresql://build:build@127.0.0.1:5432/build' }, timeout: 120000 });
    const artifacts = await loadInitialSchema(schemaSql);
    await server.start();
    const connectionString = `postgresql://postgres@${server.getServerConn()}/postgres?sslmode=disable`;
    client = new pg.Client({ connectionString });
    await client.connect();
    assert.equal(await initializeDatabase(client, artifacts), true);
    assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM "_prisma_migrations"')).rows[0].count, artifacts.migrations.length);
    const config = readBootstrapConfig({
      DATABASE_URL: 'postgresql://iholding:test@iholding-postgres:5432/iholding_db',
      NEXT_PUBLIC_COMPANY_SLUG: 'iholding', NEXT_PUBLIC_COMPANY_NAME: 'I Holding',
      BOOTSTRAP_ADMIN_NAME: 'Operador', BOOTSTRAP_ADMIN_EMAIL: 'operador@example.com',
      BOOTSTRAP_ADMIN_PASSWORD: 'only-for-tests-123456789',
      BOOTSTRAP_ADMIN_BIRTH_DATE: '1990-01-01', BOOTSTRAP_ADMIN_GENDER: 'OTHER',
    });
    await bootstrap(client, config);
    const { rows } = await db.query('SELECT u.email, u.password, u.role, c.slug, b.app_title FROM "User" u JOIN "Company" c ON u.company_id=c.id JOIN "CompanyBranding" b ON b.company_id=c.id');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].slug, 'iholding');
    assert.equal(rows[0].app_title, 'I Holding');
    assert.equal(rows[0].role, 'SUPER_ADMIN');
    assert.equal(await bcrypt.compare(config.BOOTSTRAP_ADMIN_PASSWORD, rows[0].password), true);
    for (const table of ['Property', 'Lease', 'Transaction']) {
      assert.equal((await db.query(`SELECT COUNT(*)::int AS count FROM "${table}"`)).rows[0].count, 0);
    }
    assert.ok((await db.query('SELECT COUNT(*)::int AS count FROM "AuditLogOutbox"')).rows[0].count > 0);
    await bootstrap(client, { ...config, BOOTSTRAP_ADMIN_PASSWORD: 'changed-only-for-tests' });
    assert.equal((await db.query('SELECT password FROM "User"')).rows[0].password, rows[0].password);
    assert.equal(await initializeDatabase(client, artifacts), false);
    const audit = (await db.query('SELECT new_values FROM "AuditLogOutbox" WHERE table_name=$1', ['User'])).rows[0];
    assert.ok(audit);
    assert.equal('password' in audit.new_values, false);
    assert.throws(() => assertDatabaseTarget('postgresql://nairim:test@postgres:5432/nairim_db'), /somente/);
    await client.end();
    client = null;
    const migrate = await promisify(execFile)(process.execPath, [
      'node_modules/prisma/build/index.js', 'migrate', 'deploy',
    ], { encoding: 'utf8', env: { ...process.env, DATABASE_URL: connectionString }, timeout: 60000 });
    assert.match(migrate.stdout, /No pending migrations/);
  } finally {
    if (client) await client.end();
    await server.stop();
    await db.close();
  }
});
