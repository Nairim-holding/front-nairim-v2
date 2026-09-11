import { MongoClient } from 'mongodb';

export interface StoredAuditLog {
  _id: string;
  id: string;
  company_id: string | null;
  company: { id: string; name: string } | null;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip: string | null;
  created_at: Date;
  ingested_at: Date;
}

const state = globalThis as unknown as { logsMongo?: Promise<MongoClient> };
export async function logsDatabase() {
  const uri = process.env.MONGODB_LOGS_URI;
  const database = process.env.MONGODB_LOGS_DATABASE;
  if (!uri || !database) throw new Error('Configure a conexão do banco de logs.');
  state.logsMongo ??= new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 10 })
    .connect().catch(error => { state.logsMongo = undefined; throw error; });
  return (await state.logsMongo).db(database);
}
export async function logsCollection() {
  return (await logsDatabase()).collection<StoredAuditLog>('audit_logs');
}
