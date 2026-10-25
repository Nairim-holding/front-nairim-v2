import { afterEach, beforeEach, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { applyStatementOrderMigration, MIGRATION } from '../../../scripts/apply-statement-order-migration.mjs';

const sql = readFileSync('prisma/migrations/20261025000000_transaction_statement_order/migration.sql', 'utf8');
let db: PGlite;
const client = { query: (statement: string, params?: unknown[]) => statement === sql ? db.exec(statement).then(() => ({rows:[]})) : db.query(statement, params) };
beforeEach(async () => {
  db = new PGlite();
  await db.exec(`CREATE TABLE "Transaction" (id text PRIMARY KEY, status text NOT NULL, amount numeric, financial_institution_id text, effective_date date);
    INSERT INTO "Transaction" VALUES ('legacy','COMPLETED',10,'bank','2026-10-25');`);
}, 30000);
afterEach(async () => { await db.close(); });

it('aplica a migration e registra o checksum Prisma sem mudar lançamentos; repetir não duplica', async () => {
  expect(await applyStatementOrderMigration(client, sql)).toBe('applied');
  const record = (await db.query<{checksum:string;finished_at:Date;applied_steps_count:number}>(`SELECT checksum,finished_at,applied_steps_count FROM "_prisma_migrations" WHERE migration_name=$1`, [MIGRATION])).rows[0];
  expect(record.checksum).toBe(createHash('sha256').update(sql).digest('hex'));
  expect(record.finished_at).toBeTruthy();
  expect(record.applied_steps_count).toBe(1);
  expect(await applyStatementOrderMigration(client, sql)).toBe('already-applied');
  expect((await db.query<{count:number}>(`SELECT COUNT(*)::int FROM "_prisma_migrations"`)).rows[0].count).toBe(1);
  expect((await db.query(`SELECT id,status,amount::text,statement_order FROM "Transaction"`)).rows).toEqual([{id:'legacy',status:'COMPLETED',amount:'10',statement_order:null}]);
  await db.exec(`INSERT INTO "Transaction" (id,status) VALUES ('new','COMPLETED')`);
  expect((await db.query(`SELECT statement_order FROM "Transaction" WHERE id='new'`)).rows[0]).toEqual({statement_order:1});
});

it('reconhece SQL já aplicado manualmente e registra seu histórico sem reexecutar ALTER TABLE', async () => {
  await db.exec(sql);
  expect(await applyStatementOrderMigration(client, sql)).toBe('recorded-existing');
  expect(await applyStatementOrderMigration(client, sql)).toBe('already-applied');
});

it('rejeita arquivo alterado antes de executar SQL', async () => {
  await expect(applyStatementOrderMigration(client, sql + '\nSELECT 1;')).rejects.toThrow('diferente do revisado');
  expect((await db.query(`SELECT to_regclass('"_prisma_migrations"') AS name`)).rows[0]).toEqual({name:null});
});

it('rejeita estado parcial sem sobrescrever a coluna ou registrar sucesso', async () => {
  await db.exec('ALTER TABLE "Transaction" ADD COLUMN statement_order integer');
  await expect(applyStatementOrderMigration(client, sql)).rejects.toThrow('parcialmente');
  expect((await db.query(`SELECT to_regclass('transaction_statement_order_seq') AS name`)).rows[0]).toEqual({name:null});
  expect((await db.query(`SELECT to_regclass('"_prisma_migrations"') AS name`)).rows[0]).toEqual({name:null});
});

it('reverte schema e histórico juntos se houver falha após o DDL', async () => {
  const failing = { async query(statement: string, params?: unknown[]) {
    if (statement.startsWith('INSERT INTO "_prisma_migrations"')) throw new Error('Falha simulada');
    return client.query(statement, params);
  } };
  await expect(applyStatementOrderMigration(failing, sql)).rejects.toThrow('Falha simulada');
  expect((await db.query(`SELECT COUNT(*)::int AS n FROM information_schema.columns WHERE table_name='Transaction' AND column_name='statement_order'`)).rows[0]).toEqual({n:0});
  expect((await db.query(`SELECT to_regclass('transaction_statement_order_seq') AS name`)).rows[0]).toEqual({name:null});
  expect(await applyStatementOrderMigration(client, sql)).toBe('applied');
});

it('não mascara histórico quebrado ou função modificada', async () => {
  await applyStatementOrderMigration(client, sql);
  await db.exec(`UPDATE "_prisma_migrations" SET finished_at=NULL`);
  await expect(applyStatementOrderMigration(client, sql)).rejects.toThrow('Histórico');
  await db.exec(`UPDATE "_prisma_migrations" SET finished_at=NOW(); CREATE OR REPLACE FUNCTION assign_transaction_statement_order() RETURNS trigger AS $$ BEGIN RETURN NEW; END; $$ LANGUAGE plpgsql`);
  await expect(applyStatementOrderMigration(client, sql)).rejects.toThrow('Função');
});
