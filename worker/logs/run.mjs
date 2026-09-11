import pg from 'pg';
import { MongoClient } from 'mongodb';
import { transferBatch } from './transfer.mjs';

for (const name of ['DATABASE_URL', 'MONGODB_LOGS_URI', 'MONGODB_LOGS_DATABASE']) {
  if (!process.env[name]) throw new Error(`Missing ${name}`);
}
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
// PostgreSQL timestamp without timezone stores audit times in UTC.
pg.types.setTypeParser(1114, value => new Date(value.replace(' ', 'T') + 'Z'));
const mongo = new MongoClient(process.env.MONGODB_LOGS_URI, { serverSelectionTimeoutMS: 5000 });
let stopping = false;
process.on('SIGTERM', () => { stopping = true; });
process.on('SIGINT', () => { stopping = true; });
try {
  await mongo.connect();
  const logs = mongo.db(process.env.MONGODB_LOGS_DATABASE).collection('audit_logs');
  await logs.createIndexes([
    { key: { company_id: 1, created_at: -1, id: -1 } },
    { key: { company_id: 1, user_email: 1, created_at: -1 } },
    { key: { company_id: 1, action: 1, created_at: -1 } },
    { key: { company_id: 1, table_name: 1, created_at: -1 } },
  ]);
  do {
    let connection;
    try {
      connection = await pool.connect();
      const count = await transferBatch(connection, logs);
      if (count) console.log(`Logs transferred: ${count}`);
      if (process.argv.includes('--once') && !count) break;
      if (count) continue;
    } catch (error) {
      console.error('Log transfer failed; pending entries retained:', error.code || error.name);
      if (process.argv.includes('--once')) throw error;
    } finally { connection?.release(); }
    await new Promise(resolve => setTimeout(resolve, 2000));
  } while (!stopping);
} finally { await pool.end(); await mongo.close(); }
