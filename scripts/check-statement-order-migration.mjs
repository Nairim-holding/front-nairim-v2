import { Client } from 'pg';

// Read-only preflight. Can be passed through stdin to the currently running app.
const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000, query_timeout: 10000 });
try {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL_MISSING');
  await client.connect();
  await client.query('BEGIN READ ONLY');
  const { rows: [schema] } = await client.query(`SELECT
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'Transaction' AND column_name = 'statement_order') AS column_ready,
    EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = to_regclass('"Transaction"') AND tgname = 'transaction_statement_order' AND tgenabled = 'O') AS trigger_ready,
    to_regclass('transaction_statement_order_seq') IS NOT NULL AS sequence_ready`);
  await client.query('COMMIT');
  if (!schema.column_ready || !schema.trigger_ready || !schema.sequence_ready) {
    console.error('Deploy interrompido: aplique a migração 20261025000000_transaction_statement_order com prisma migrate deploy no banco deste ambiente. Containers atuais preservados.');
    process.exitCode = 1;
  } else {
    console.log('Migração de sequência do extrato verificada.');
  }
} catch {
  console.error('Não foi possível verificar a migração do extrato. Confira a conexão do ambiente antes de repetir o deploy.');
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
