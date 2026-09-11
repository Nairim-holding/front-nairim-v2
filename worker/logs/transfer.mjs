// PostgreSQL advisory lock is also used by purge: a replay cannot resurrect purged logs.
export const LOGS_LOCK = 739182406;
export async function transferBatch(pg, collection) {
  await pg.query('BEGIN');
  try {
    await pg.query('SELECT pg_advisory_xact_lock($1)', [LOGS_LOCK]);
    const { rows } = await pg.query(`SELECT q.*, CASE WHEN c.id IS NULL THEN NULL
      ELSE json_build_object('id',c.id,'name',c.name) END AS company
      FROM "AuditLogOutbox" q LEFT JOIN "Company" c ON c.id=q.company_id
      ORDER BY q.created_at,q.id LIMIT 500 FOR UPDATE OF q`);
    if (rows.length) {
      await collection.bulkWrite(rows.map(row => ({ updateOne: {
        filter: { _id: row.id },
        update: { $setOnInsert: { ...row, _id: row.id, ingested_at: new Date() } },
        upsert: true,
      } })), { ordered: true, writeConcern: { w: 'majority', j: true } });
      await pg.query('DELETE FROM "AuditLogOutbox" WHERE id = ANY($1::text[])', [rows.map(row => row.id)]);
    }
    await pg.query('COMMIT');
    return rows.length;
  } catch (error) {
    await pg.query('ROLLBACK');
    throw error;
  }
}
