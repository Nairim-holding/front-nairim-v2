import { createHash, randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

export function assertDatabaseTarget(connectionString) {
  const url = new URL(connectionString);
  if (url.hostname !== 'iholding-postgres' || url.pathname !== '/iholding_db' || url.username !== 'iholding') {
    throw new Error('Inicializacao permitida somente em iholding-postgres/iholding_db com usuario iholding.');
  }
}

export async function loadInitialSchema(schemaSql) {
  const migrationRoot = new URL('../../prisma/migrations/', import.meta.url);
  const names = (await readdir(migrationRoot, { withFileTypes: true }))
    .filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  const migrations = await Promise.all(names.map(async name => ({
    name, sql: await readFile(new URL(`${name}/migration.sql`, migrationRoot), 'utf8'),
  })));
  const restore = migrations.find(item => item.name === '20260908000000_restore_audit_trail')?.sql;
  const move = migrations.find(item => item.name === '20260911000000_move_logs_to_mongodb')?.sql;
  const repairs = migrations.find(item => item.name === '20261004000000_property_repairs')?.sql;
  const repairItems = migrations.find(item => item.name === '20261006000000_repair_items_and_professionals')?.sql;
  const reportingIndexes = migrations.find(item => item.name === '20261006010000_reporting_indexes')?.sql;
  if (!restore || !move || !repairs || !repairItems || !reportingIndexes) throw new Error('Migrations de auditoria/reparos/relatorios nao encontradas.');

  // Reutiliza as funcoes SQL originais, sem criar AuditLog antigo ou renomear
  // a fila que o schema atual ja cria. Falha se os delimitadores forem alterados.
  const snapshot = restore.match(/CREATE OR REPLACE FUNCTION nairim_audit_snapshot[\s\S]*?\n\$\$;/)?.[0];
  const writer = move.match(/CREATE OR REPLACE FUNCTION nairim_write_audit_log[\s\S]*?\n\$\$;/)?.[0];
  const triggers = restore.match(/DO \$\$\s*DECLARE model text;[\s\S]*?\n\$\$;/)?.[0];
  const repairTriggers = repairs.match(/CREATE TRIGGER nairim_audit[\s\S]*?\('Repair(?:Media)?'\);/g);
  const checks = [...repairs.matchAll(/CONSTRAINT "(Repair(?:Media)?_[^"]+_check)" (CHECK \([^\n]+\))/g)]
    .map(match => `ALTER TABLE "${match[1].startsWith('RepairMedia_') ? 'RepairMedia' : 'Repair'}" ADD CONSTRAINT "${match[1]}" ${match[2]};`);
  const itemTriggers = repairItems.match(/CREATE TRIGGER nairim_audit[\s\S]*?\('Repair(?:Item|Professional)'\);/g);
  const itemChecks = [...repairItems.matchAll(/CONSTRAINT "(Repair(?:Item)?_[^"]+_check)"\s+(CHECK \([^\n]+\))/g)]
    .map(match => `ALTER TABLE "${match[1].startsWith('RepairItem_') ? 'RepairItem' : 'Repair'}" ADD CONSTRAINT "${match[1]}" ${match[2]};`);
  if (!snapshot || !writer || !triggers || repairTriggers?.length !== 2 || checks.length !== 5 || itemTriggers?.length !== 2 || itemChecks.length !== 3) {
    throw new Error('Definicoes SQL de auditoria/reparos mudaram. Revise a inicializacao antes de publicar.');
  }
  return { schemaSql, auditSql: [snapshot, writer, triggers, ...repairTriggers, ...checks, ...itemTriggers, ...itemChecks, reportingIndexes].join('\n'), migrations };
}

export async function initializeDatabase(client, artifacts) {
  await client.query('BEGIN');
  try {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('iholding-initialize'))");
    const { rows } = await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'");
    if (rows.length) {
      await client.query('COMMIT');
      return false; // Nunca recria um banco ja inicializado.
    }
    await client.query(artifacts.schemaSql);
    await client.query(artifacts.auditSql);
    // Baseline do schema atual: o historico antigo depende de tabelas que
    // foram criadas fora das migrations. Registra os checksums originais,
    // seguindo o mesmo formato usado pelos scripts de migracao deste repo.
    // Tudo fica na mesma transacao: falhas nao deixam uma instalacao parcial.
    await client.query(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" VARCHAR(36) PRIMARY KEY, "checksum" VARCHAR(64) NOT NULL,
      "finished_at" TIMESTAMPTZ, "migration_name" VARCHAR(255) NOT NULL,
      "logs" TEXT, "rolled_back_at" TIMESTAMPTZ,
      "started_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    )`);
    for (const migration of artifacts.migrations) {
      await client.query(`INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, applied_steps_count)
        VALUES ($1, $2, NOW(), $3, 1)`,
      [randomUUID(), createHash('sha256').update(migration.sql).digest('hex'), migration.name]);
    }
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let client;
  try {
    assertDatabaseTarget(process.env.DATABASE_URL);
    const artifacts = await loadInitialSchema(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
    client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    console.log(await initializeDatabase(client, artifacts)
      ? 'Schema atual e auditoria inicializados no banco vazio da iholding.'
      : 'Banco ja inicializado; seguindo para as migrations pendentes.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    if (client) await client.end();
  }
}
