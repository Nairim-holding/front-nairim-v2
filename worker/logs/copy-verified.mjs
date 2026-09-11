import { isDeepStrictEqual } from 'node:util';

/** Existing IDs are never overwritten: a conflicting copy must stop the migration. */
export async function copyVerified(collection, rows) {
  if (!rows.length) return;
  await collection.bulkWrite(rows.map(row => ({ updateOne: {
    filter: { _id: row.id },
    update: { $setOnInsert: { ...row, _id: row.id, ingested_at: new Date() } },
    upsert: true,
  } })), { ordered: true, writeConcern: { w: 'majority', j: true } });
  const copies = await collection.find({ _id: { $in: rows.map(row => row.id) } }).toArray();
  const byId = new Map(copies.map(row => [row._id, row]));
  for (const row of rows) {
    const copy = byId.get(row.id);
    // Company display names can change after first delivery; original columns cannot.
    if (!copy || Object.keys(row).some(key => key !== 'company' && !isDeepStrictEqual(row[key], copy[key]))) {
      throw new Error(`A cópia do log ${row.id} não confere. A origem foi preservada.`);
    }
  }
}
