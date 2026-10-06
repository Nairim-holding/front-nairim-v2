import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('migration da vitrine preserva empresas e permite trocar a selecao', async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE "Company" (id TEXT PRIMARY KEY, name TEXT NOT NULL); INSERT INTO "Company" VALUES (\'a\', \'Wagner\'), (\'b\', \'Rosana\');');
    await db.exec(await readFile(new URL('../../prisma/migrations/20261006180000_public_site_settings/migration.sql', import.meta.url), 'utf8'));
    assert.equal((await db.query('SELECT count(*)::int AS n FROM "Company"')).rows[0].n, 2);
    await db.exec('INSERT INTO "PublicSiteSettings" (id, company_id, updated_at) VALUES (\'main\', \'a\', NOW()); UPDATE "PublicSiteSettings" SET company_id=\'b\' WHERE id=\'main\';');
    assert.equal((await db.query('SELECT company_id FROM "PublicSiteSettings"')).rows[0].company_id, 'b');
    await assert.rejects(db.exec('UPDATE "PublicSiteSettings" SET company_id=\'inexistente\';'), /foreign key/);
    await assert.rejects(db.exec('DELETE FROM "Company" WHERE id=\'b\';'), /foreign key/);
  } finally { await db.close(); }
});
