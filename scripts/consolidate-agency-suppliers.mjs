/**
 * Somente leitura por padrão. Não carrega .env automaticamente.
 * DATABASE_URL deve apontar para o banco escolhido pelo operador.
 * node scripts/consolidate-agency-suppliers.mjs --company ID
 * node scripts/consolidate-agency-suppliers.mjs --company ID --keep ID --duplicate ID [--apply]
 */
import pg from 'pg';

const args = process.argv.slice(2);
const option = key => args[args.indexOf(key) + 1];
const company = args.includes('--company') ? option('--company') : null;
const keep = args.includes('--keep') ? option('--keep') : null;
const duplicate = args.includes('--duplicate') ? option('--duplicate') : null;
const apply = args.includes('--apply');
const quote = name => `"${name.replaceAll('"', '""')}"`;
if (!company || !process.env.DATABASE_URL || (apply && (!keep || !duplicate))) {
  throw new Error('Informe DATABASE_URL e --company. Para consolidar, informe --keep, --duplicate e --apply.');
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(apply ? 'BEGIN' : 'BEGIN READ ONLY');
  await client.query("SET LOCAL lock_timeout = '5s'");
  if (!keep || !duplicate) {
    const { rows } = await client.query(`
      SELECT s.id, s.internal_code, s.legal_name, s.trade_name, s.cnpj, s.agency_id,
        (SELECT count(*) FROM "Transaction" t WHERE t.supplier_id = s.id) AS transactions,
        (SELECT count(*) FROM "RecurringConfig" r WHERE r.supplier_id = s.id) AS recurrences
      FROM "Supplier" s WHERE s.company_id = $1 AND s.deleted_at IS NULL
      AND (s.internal_code LIKE 'AG-%' OR s.agency_id IS NOT NULL OR
        EXISTS (SELECT 1 FROM "Agency" a WHERE a.company_id = s.company_id AND a.deleted_at IS NULL
          AND length(regexp_replace(a.cnpj, '\\D', '', 'g')) = 14
          AND regexp_replace(a.cnpj, '\\D', '', 'g') = regexp_replace(s.cnpj, '\\D', '', 'g')))
      ORDER BY s.legal_name, s.created_at`, [company]);
    console.table(rows);
  } else {
    if (keep === duplicate) throw new Error('Os IDs devem ser diferentes.');
    // Bloqueia referências concorrentes durante a troca de vínculos.
    const { rows } = await client.query(`SELECT * FROM "Supplier" WHERE company_id = $1 AND id = ANY($2::text[]) ORDER BY id${apply ? ' FOR UPDATE' : ''}`, [company, [keep, duplicate]]);
    const canonical = rows.find(row => row.id === keep);
    const redundant = rows.find(row => row.id === duplicate);
    if (!canonical || !redundant || canonical.deleted_at || redundant.deleted_at) throw new Error('Dois contatos ativos da mesma empresa são obrigatórios.');
    const digits = value => (value ?? '').replace(/\D/g, '');
    if (digits(canonical.cnpj).length !== 14 || digits(canonical.cnpj) !== digits(redundant.cnpj)) {
      throw new Error('CNPJ ausente ou diferente. Necessária conferência individual; nada foi alterado.');
    }
    if (canonical.agency_id && redundant.agency_id && canonical.agency_id !== redundant.agency_id) {
      throw new Error('Os contatos estão vinculados a imobiliárias diferentes.');
    }
    const { rows: references } = await client.query(`
      SELECT ns.nspname AS schema_name, rel.relname AS table_name, att.attname AS column_name,
        cardinality(fk.conkey) AS column_count
      FROM pg_constraint fk JOIN pg_class rel ON rel.oid = fk.conrelid
      JOIN pg_namespace ns ON ns.oid = rel.relnamespace
      JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = fk.conkey[1]
      WHERE fk.contype = 'f' AND fk.confrelid = '"Supplier"'::regclass`);
    const impact = [];
    for (const ref of references) {
      if (ref.column_count !== 1) throw new Error('Vínculo composto exige revisão manual.');
      const table = `${quote(ref.schema_name)}.${quote(ref.table_name)}`;
      const column = quote(ref.column_name);
      const { rows: [count] } = await client.query(`SELECT count(*)::int AS total FROM ${table} WHERE ${column} = $1`, [duplicate]);
      // Impede mover dados que já possuam um vínculo inconsistente entre empresas.
      const { rows: [scope] } = await client.query(`SELECT count(*)::int AS total FROM ${table} AS r WHERE ${column} = $1 AND to_jsonb(r)->>'company_id' IS NOT NULL AND to_jsonb(r)->>'company_id' <> $2`, [duplicate, company]);
      if (scope.total) throw new Error(`Vínculo de outra empresa em ${ref.table_name}.`);
      impact.push({ table: ref.table_name, column: ref.column_name, records: count.total });
      if (apply) await client.query(`UPDATE ${table} SET ${column} = $1 WHERE ${column} = $2`, [keep, duplicate]);
    }
    console.table([{ id: keep, name: canonical.legal_name, action: 'manter' }, { id: duplicate, name: redundant.legal_name, action: 'consolidar e desativar' }]);
    console.table(impact);
    if (apply) {
      await client.query('UPDATE "Supplier" SET agency_id = coalesce(agency_id, $2), updated_at = now() WHERE id = $1', [keep, redundant.agency_id]);
      await client.query('UPDATE "Supplier" SET agency_id = NULL, deleted_at = now(), is_active = false, updated_at = now() WHERE id = $1', [duplicate]);
      for (const ref of references) {
        const { rows: [count] } = await client.query(`SELECT count(*)::int AS total FROM ${quote(ref.schema_name)}.${quote(ref.table_name)} WHERE ${quote(ref.column_name)} = $1`, [duplicate]);
        if (count.total) throw new Error('Ainda há vínculos no contato duplicado. Operação revertida.');
      }
    }
  }
  await client.query(apply ? 'COMMIT' : 'ROLLBACK');
  console.log(apply ? 'Consolidação concluída; registro duplicado preservado no histórico como excluído.' : 'Prévia concluída. Nenhum dado alterado.');
} catch (error) {
  await client.query('ROLLBACK');
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
