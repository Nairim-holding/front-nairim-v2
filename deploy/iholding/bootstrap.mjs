import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

export function readBootstrapConfig(environment) {
  const schema = z.object({
    DATABASE_URL: z.string().url(),
    NEXT_PUBLIC_COMPANY_SLUG: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    NEXT_PUBLIC_COMPANY_NAME: z.string().trim().min(1),
    BOOTSTRAP_ADMIN_NAME: z.string().trim().min(1),
    BOOTSTRAP_ADMIN_EMAIL: z.string().trim().toLowerCase().email(),
    BOOTSTRAP_ADMIN_PASSWORD: z.string().min(16).refine(
      value => value === value.trim() && Buffer.byteLength(value) <= 72,
      'A senha deve ter ate 72 bytes e nao pode iniciar/terminar com espacos.',
    ),
    BOOTSTRAP_ADMIN_BIRTH_DATE: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
      const date = new Date(`${value}T00:00:00Z`);
      return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && date < new Date();
    }, 'Informe uma data de nascimento valida no formato AAAA-MM-DD.'),
    BOOTSTRAP_ADMIN_GENDER: z.enum(['MALE', 'FEMALE', 'OTHER']),
  });
  const result = schema.safeParse(environment);
  if (!result.success) {
    // Mensagens sem os valores recebidos (podem conter senhas).
    throw new Error(`Revise as variaveis: ${[...new Set(result.error.issues.map(issue => issue.path[0]))].join(', ')}`);
  }
  const config = result.data;
  const target = new URL(config.DATABASE_URL);
  if (target.hostname !== 'iholding-postgres' || target.pathname !== '/iholding_db' || target.username !== 'iholding') {
    throw new Error('Bootstrap permitido somente em iholding-postgres/iholding_db com usuario iholding.');
  }
  return config;
}

export async function bootstrap(client, config) {
  await client.query('BEGIN');
  try {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('iholding-bootstrap'))");
    const companies = await client.query('SELECT id, slug FROM "Company"');
    const users = await client.query('SELECT company_id, email, role, is_active, deleted_at FROM "User"');
    if (companies.rows.length || users.rows.length) {
      // Uma repeticao nunca troca senha nem cria um administrador em banco povoado.
      const alreadyCreated = companies.rows.length === 1 && users.rows.length === 1 &&
        companies.rows[0].slug === config.NEXT_PUBLIC_COMPANY_SLUG &&
        users.rows[0].company_id === companies.rows[0].id &&
        users.rows[0].email === config.BOOTSTRAP_ADMIN_EMAIL &&
        users.rows[0].role === 'SUPER_ADMIN' && users.rows[0].is_active && !users.rows[0].deleted_at;
      if (!alreadyCreated) throw new Error('O banco ja contem empresas/usuarios. Bootstrap recusado; administre pela interface.');
      await client.query('COMMIT');
      return 'Cadastro inicial ja existe; nenhuma senha ou dado foi alterado.';
    }

    const companyId = randomUUID();
    const passwordHash = await bcrypt.hash(config.BOOTSTRAP_ADMIN_PASSWORD, 12);
    await client.query(
      'INSERT INTO "Company" (id, name, slug, updated_at) VALUES ($1, $2, $3, NOW())',
      [companyId, config.NEXT_PUBLIC_COMPANY_NAME, config.NEXT_PUBLIC_COMPANY_SLUG],
    );
    await client.query(
      'INSERT INTO "CompanyBranding" (id, company_id, company_name, trade_name, app_title, updated_at) VALUES ($1, $2, $3, $3, $3, NOW())',
      [randomUUID(), companyId, config.NEXT_PUBLIC_COMPANY_NAME],
    );
    await client.query(
      `INSERT INTO "User" (id, company_id, name, email, password, birth_date, gender, role, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::date, $7::"Gender", 'SUPER_ADMIN', NOW())`,
      [randomUUID(), companyId, config.BOOTSTRAP_ADMIN_NAME, config.BOOTSTRAP_ADMIN_EMAIL,
        passwordHash, config.BOOTSTRAP_ADMIN_BIRTH_DATE, config.BOOTSTRAP_ADMIN_GENDER],
    );
    await client.query('COMMIT');
    return 'Empresa e administrador inicial criados. Cadastros de negocio permanecem vazios.';
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let client;
  try {
    const config = readBootstrapConfig(process.env);
    client = new pg.Client({ connectionString: config.DATABASE_URL });
    await client.connect();
    console.log(await bootstrap(client, config));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    if (client) await client.end();
  }
}
