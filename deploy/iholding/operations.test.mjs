import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readBootstrapConfig, bootstrap } from './bootstrap.mjs';
import { dueMonth, syncIndexes } from './scheduler.mjs';

const environment = {
  DATABASE_URL: 'postgresql://iholding:test@iholding-postgres:5432/iholding_db',
  NEXT_PUBLIC_COMPANY_SLUG: 'iholding', NEXT_PUBLIC_COMPANY_NAME: 'I Holding',
  BOOTSTRAP_ADMIN_NAME: 'Operador', BOOTSTRAP_ADMIN_EMAIL: 'OPERADOR@example.com',
  BOOTSTRAP_ADMIN_PASSWORD: 'only-for-tests-123456789',
  BOOTSTRAP_ADMIN_BIRTH_DATE: '1990-01-01', BOOTSTRAP_ADMIN_GENDER: 'OTHER',
};

test('bootstrap recusa enderecos que possam atingir a Nairim', () => {
  for (const DATABASE_URL of [
    'postgresql://nairim:test@postgres:5432/nairim_db',
    'postgresql://iholding:test@iholding-postgres:5432/nairim_db',
    'postgresql://iholding:test@localhost:5432/iholding_db',
  ]) assert.throws(() => readBootstrapConfig({ ...environment, DATABASE_URL }), /somente/);
  assert.equal(readBootstrapConfig(environment).BOOTSTRAP_ADMIN_EMAIL, 'operador@example.com');
});

test('bootstrap exige dados reais e senha sem truncamento bcrypt', () => {
  for (const changes of [
    { BOOTSTRAP_ADMIN_BIRTH_DATE: '2000-02-30' }, { BOOTSTRAP_ADMIN_EMAIL: '' },
    { BOOTSTRAP_ADMIN_GENDER: '' }, { BOOTSTRAP_ADMIN_PASSWORD: 'x'.repeat(73) },
    { BOOTSTRAP_ADMIN_PASSWORD: ' senha-com-espaco-no-inicio' },
  ]) assert.throws(() => readBootstrapConfig({ ...environment, ...changes }), /Revise/);
});

test('bootstrap em banco povoado nao cria nem altera usuarios', async () => {
  const queries = [];
  const client = { async query(sql) {
    queries.push(sql);
    return { rows: sql.includes('FROM "Company"') ? [{ id: 'c1', slug: 'outro' }] : [] };
  } };
  await assert.rejects(bootstrap(client, readBootstrapConfig(environment)), /ja contem/);
  assert.ok(queries.includes('ROLLBACK'));
  assert.ok(!queries.some(query => /INSERT|UPDATE|DELETE/.test(query)));
});

test('repetir bootstrap da mesma instalacao nao redefine a senha', async () => {
  const queries = [];
  const client = { async query(sql) {
    queries.push(sql);
    const rows = sql.includes('FROM "Company"') ? [{ id: 'c1', slug: 'iholding' }] :
      sql.includes('FROM "User"') ? [{ company_id: 'c1', email: 'operador@example.com', role: 'SUPER_ADMIN', is_active: true, deleted_at: null }] : [];
    return { rows };
  } };
  assert.match(await bootstrap(client, readBootstrapConfig(environment)), /nenhuma senha/);
  assert.ok(queries.includes('COMMIT'));
  assert.ok(!queries.some(query => /INSERT|UPDATE|DELETE/.test(query)));
});

test('falha ao criar o usuario reverte tambem a empresa e o branding', async () => {
  const queries = [];
  const client = { async query(sql) {
    queries.push(sql);
    if (sql.includes('INSERT INTO "User"')) throw new Error('falha simulada');
    return { rows: [] };
  } };
  await assert.rejects(bootstrap(client, readBootstrapConfig(environment)), /falha simulada/);
  assert.ok(queries.includes('ROLLBACK'));
  assert.ok(!queries.includes('COMMIT'));
});

test('agendamento considera o fuso brasileiro, recupera atraso e nao repete o mes', () => {
  assert.equal(dueMonth(new Date('2026-10-05T11:59:00Z')), null);
  assert.equal(dueMonth(new Date('2026-10-05T12:00:00Z')), '2026-10');
  assert.equal(dueMonth(new Date('2026-10-10T00:00:00Z')), '2026-10');
  assert.equal(dueMonth(new Date('2026-10-10T00:00:00Z'), '2026-10'), null);
  assert.equal(dueMonth(new Date('2026-11-01T12:00:00Z'), '2026-10'), null);
  assert.equal(dueMonth(new Date('2026-11-05T12:00:00Z'), '2026-10'), '2026-11');
});

test('agendador detecta erro por empresa mesmo com resposta HTTP 200', async () => {
  await assert.rejects(syncIndexes('test', async () => ({ ok: true, json: async () => ({ ok: true, companies: [{ error: 'BC indisponivel' }] }) })), /incompleta/);
  await assert.rejects(syncIndexes('test', async () => ({ ok: false, status: 401 })), /HTTP 401/);
  await assert.rejects(syncIndexes('test', async () => ({ ok: true, json: async () => ({ ok: true, companies: [] }) })), /incompleta/);
  await syncIndexes('test', async () => ({ ok: true, json: async () => ({ ok: true, companies: [{ synced: 2 }] }) }));
});
