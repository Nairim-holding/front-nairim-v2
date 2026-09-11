import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyVerified } from './copy-verified.mjs';

function collection(copies) {
  return { bulkWrite: async () => {}, find: () => ({ toArray: async () => copies }) };
}
test('checks original fields, including snapshots and dates, for every tenant', async () => {
  const rows = [{id:'a',company_id:'one',created_at:new Date(0),old_values:{n:2}}, {id:'b',company_id:'two'}];
  await copyVerified(collection(rows.map(row => ({...row,_id:row.id}))), rows);
});
test('missing or conflicting Mongo documents stop migration', async () => {
  await assert.rejects(copyVerified(collection([]), [{id:'a'}]), /preservada/);
  await assert.rejects(copyVerified(collection([{_id:'a',id:'a',old_values:{n:3}}]), [{id:'a',old_values:{n:2}}]), /preservada/);
});
test('a failed durable write cannot pass verification', async () => {
  const c = collection([]); c.bulkWrite = async () => { throw new Error('offline'); };
  await assert.rejects(copyVerified(c,[{id:'a'}]), /offline/);
});
