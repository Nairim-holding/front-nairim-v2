import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transferBatch } from './transfer.mjs';

function setup(failure) {
  const events = [];
  const row = { id: 'log-1', company_id: 'a', created_at: new Date() };
  const pg = { query: async sql => {
    events.push(sql);
    if (sql.startsWith('SELECT q.')) return { rows: [row] };
    if (failure === 'delete' && sql.startsWith('DELETE')) throw new Error('PG unavailable');
    return { rows: [] };
  } };
  const collection = { bulkWrite: async (ops, options) => {
    events.push('MONGO');
    assert.equal(ops[0].updateOne.filter._id, row.id);
    assert.equal(ops[0].updateOne.upsert, true);
    assert.equal(ops[0].updateOne.update.$setOnInsert.company_id, 'a');
    assert.deepEqual(options.writeConcern, { w: 'majority', j: true });
    if (failure === 'mongo') throw new Error('Mongo unavailable');
  } };
  return { events, pg, collection };
}
test('acknowledges durable Mongo write before deleting pending records', async () => {
  const { events, pg, collection } = setup();
  assert.equal(await transferBatch(pg, collection), 1);
  assert.ok(events.indexOf('MONGO') < events.findIndex(e => e.startsWith('DELETE')));
  assert.equal(events.at(-1), 'COMMIT');
});
test('Mongo outage retains pending entries', async () => {
  const { events, pg, collection } = setup('mongo');
  await assert.rejects(transferBatch(pg, collection));
  assert.ok(!events.some(e => e.startsWith('DELETE')));
  assert.equal(events.at(-1), 'ROLLBACK');
});
test('PG acknowledgement failure rolls back; stable ID makes delivery retry idempotent', async () => {
  const { events, pg, collection } = setup('delete');
  await assert.rejects(transferBatch(pg, collection));
  assert.equal(events.at(-1), 'ROLLBACK');
});
