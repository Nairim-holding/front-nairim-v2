import { Client } from 'pg';
import { createHash, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const MIGRATION = '20261025000000_transaction_statement_order';
const expectedChecksum = '70a231baeaebacb778574aec06e66b2ac9de6a119823a7b47a6a3fc10f165ea9';
const hash = value => createHash('sha256').update(value).digest('hex');
const normalize = value => value.replace(/\r\n/g, '\n');
class MigrationStateError extends Error {}

/** Applies only this reviewed, additive migration. Schema and history commit together. */
export async function applyStatementOrderMigration(client, sql) {
  if (typeof sql !== 'string' || hash(normalize(sql)) !== expectedChecksum) {
    throw new MigrationStateError('Arquivo da migração do extrato ausente ou diferente do revisado. Atualize o checkout.');
  }
  const functionBody = normalize(sql).match(/AS \$\$([\s\S]*?)\$\$ LANGUAGE plpgsql;/)[1].trim();
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query("SET LOCAL statement_timeout = '60s'");
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [MIGRATION]);
    const { rows: [schema] } = await client.query(`SELECT
      to_regclass('"Transaction"') IS NOT NULL AS table_ready,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='Transaction' AND column_name='statement_order' AND data_type='integer' AND is_nullable='YES') AS column_ready,
      EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid WHERE t.tgrelid=to_regclass('"Transaction"') AND t.tgname='transaction_statement_order' AND t.tgenabled='O' AND p.proname='assign_transaction_statement_order') AS trigger_ready,
      to_regclass('transaction_statement_order_seq') IS NOT NULL AS sequence_ready,
      to_regclass('"Transaction_statement_order_idx"') IS NOT NULL AS index_ready,
      EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=current_schema() AND p.proname='assign_transaction_statement_order' AND p.pronargs=0) AS function_ready`);
    if (!schema.table_ready) throw new MigrationStateError('Tabela Transaction ausente. Confira o banco do container.');
    await client.query(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      id VARCHAR(36) PRIMARY KEY, checksum VARCHAR(64) NOT NULL,
      finished_at TIMESTAMPTZ, migration_name VARCHAR(255) NOT NULL,
      logs TEXT, rolled_back_at TIMESTAMPTZ,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), applied_steps_count INTEGER NOT NULL DEFAULT 0
    )`);
    const { rows: [record] } = await client.query('SELECT checksum, finished_at FROM "_prisma_migrations" WHERE migration_name=$1 AND rolled_back_at IS NULL ORDER BY started_at DESC LIMIT 1', [MIGRATION]);
    const objects = [schema.column_ready, schema.trigger_ready, schema.sequence_ready, schema.index_ready, schema.function_ready];
    const complete = objects.every(Boolean);
    if (record && (!record.finished_at || ![hash(sql), expectedChecksum].includes(record.checksum))) {
      throw new MigrationStateError('Histórico da migração do extrato incompleto ou divergente. Nenhum objeto foi alterado; revise _prisma_migrations.');
    }
    if ((record && !complete) || (!complete && objects.some(Boolean))) {
      throw new MigrationStateError('Schema do extrato parcialmente aplicado. Nenhum objeto foi sobrescrito; revise a migração antes de repetir.');
    }
    if (complete) {
      const { rows: [definition] } = await client.query("SELECT p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=current_schema() AND p.proname='assign_transaction_statement_order' AND p.pronargs=0");
      if (normalize(definition.prosrc).trim() !== functionBody) throw new MigrationStateError('Função do extrato diverge da migração revisada. Nenhuma alteração aplicada.');
    } else {
      await client.query(sql);
    }
    if (!record) await client.query(`INSERT INTO "_prisma_migrations" (id,checksum,finished_at,migration_name,applied_steps_count) VALUES ($1,$2,NOW(),$3,1)`, [randomUUID(), hash(sql), MIGRATION]);
    await client.query('COMMIT');
    return record ? 'already-applied' : complete ? 'recorded-existing' : 'applied';
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  }
}

if (!process.argv[1] || import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000, query_timeout: 70000 });
  try {
    if (!process.env.DATABASE_URL) throw new MigrationStateError('DATABASE_URL ausente no container.');
    const sql = Buffer.from(process.env.NAIRIM_STATEMENT_ORDER_SQL ?? '', 'base64').toString('utf8');
    await client.connect();
    const result = await applyStatementOrderMigration(client, sql);
    console.log(`${MIGRATION}: ${result === 'already-applied' ? 'já aplicada' : result === 'recorded-existing' ? 'schema existente registrado no histórico' : 'aplicada com sucesso'}.`);
  } catch (error) {
    const code = typeof error?.code === 'string' && /^[0-9A-Z]{5}$/.test(error.code) ? ` SQLSTATE ${error.code}.` : '';
    console.error(error instanceof MigrationStateError ? error.message : `Falha ao aplicar a migração do extrato; a transação foi revertida.${code} Confira conexão, permissões e bloqueios do banco.`);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}
