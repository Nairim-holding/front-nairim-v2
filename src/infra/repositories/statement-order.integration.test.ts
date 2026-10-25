import { afterAll, beforeAll, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
let db: PGlite;
const preflightSql = readFileSync('scripts/check-statement-order-migration.mjs', 'utf8').match(/client\.query\(`(SELECT[\s\S]*?)`\)/)![1];
let schemaBefore: Record<string, unknown>;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE TABLE "Transaction" (id text PRIMARY KEY, status text NOT NULL, amount numeric, financial_institution_id text, effective_date date);
    INSERT INTO "Transaction" VALUES ('legacy','COMPLETED',10,'bank','2026-10-25');`);
  schemaBefore = (await db.query<Record<string, unknown>>(preflightSql)).rows[0];
  await db.exec(readFileSync('prisma/migrations/20261025000000_transaction_statement_order/migration.sql', 'utf8'));
}, 30000);
afterAll(async () => { await db?.close(); });
it('preflight bloqueia banco sem migração e aceita somente coluna, sequência e trigger habilitada', async () => {
  expect(schemaBefore).toEqual({column_ready:false,trigger_ready:false,sequence_ready:false});
  expect((await db.query(preflightSql)).rows[0]).toEqual({column_ready:true,trigger_ready:true,sequence_ready:true});
  await db.exec('ALTER TABLE "Transaction" DISABLE TRIGGER "transaction_statement_order"');
  expect((await db.query<{trigger_ready:boolean}>(preflightSql)).rows[0].trigger_ready).toBe(false);
  await db.exec('ALTER TABLE "Transaction" ENABLE TRIGGER "transaction_statement_order"');
});
it('registra a ordem de conclusão e preserva edição, reabertura e legado sem criar histórico fictício', async () => {
  await db.exec(`INSERT INTO "Transaction" (id,status) VALUES ('a','PENDING'),('b','COMPLETED'),('c','PENDING');
    UPDATE "Transaction" SET status='COMPLETED' WHERE id='c';
    UPDATE "Transaction" SET status='COMPLETED' WHERE id='a';`);
  const rows = () => db.query<{ id: string; statement_order: number | null }>('SELECT id,statement_order FROM "Transaction" ORDER BY statement_order NULLS FIRST,id');
  expect((await rows()).rows).toEqual([{id:'legacy',statement_order:null},{id:'b',statement_order:1},{id:'c',statement_order:2},{id:'a',statement_order:3}]);
  await db.exec(`UPDATE "Transaction" SET amount=20,statement_order=500 WHERE id='b'; UPDATE "Transaction" SET amount=30 WHERE id='legacy';`);
  expect((await rows()).rows[1]).toEqual({ id:'b', statement_order:1 });
  expect((await rows()).rows[0]).toEqual({ id:'legacy', statement_order:null });
  await db.exec(`UPDATE "Transaction" SET status='PENDING' WHERE id='b';`);
  expect((await rows()).rows.find(row => row.id === 'b')?.statement_order).toBeNull();
  await db.exec(`UPDATE "Transaction" SET status='COMPLETED' WHERE id='b';`);
  expect((await rows()).rows.at(-1)).toEqual({ id:'b', statement_order:4 });
});
