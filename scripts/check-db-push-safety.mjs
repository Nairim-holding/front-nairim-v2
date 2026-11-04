// Somente leitura: mostra o que `prisma db push` faria no banco apontado por
// DATABASE_URL e falha (exit 1) se houver qualquer perda de dados.
//
// Uso: npm run db:push-check
//      (ou, para outro banco: DATABASE_URL=... npm run db:push-check)
//
// Usa `prisma migrate diff`, que apenas lê o banco e imprime o SQL; nada é executado.
import { spawnSync } from 'node:child_process';

const result = spawnSync(
  'npx',
  ['prisma', 'migrate', 'diff', '--from-config-datasource', '--to-schema', 'prisma/schema.prisma', '--script'],
  { encoding: 'utf8', shell: true },
);

if (result.status !== 0) {
  console.error('Não foi possível comparar o banco com o schema.');
  console.error(result.stderr || result.stdout);
  process.exit(2);
}

const sql = result.stdout
  .split('\n')
  .filter(line => line.trim() && !line.trim().startsWith('--') && !line.startsWith('Loaded Prisma config'))
  .join('\n');

if (!sql.trim()) {
  console.log('Banco e schema.prisma idênticos: o db push não faria nada.');
  process.exit(0);
}

const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
const dataLoss = statements.filter(s =>
  /\bDROP\s+(TABLE|COLUMN|TYPE|SCHEMA)\b/i.test(s) ||
  /\bALTER\s+COLUMN\b[\s\S]*\bTYPE\b/i.test(s) ||
  /\bTRUNCATE\b|\bDELETE\s+FROM\b/i.test(s),
);
const otherDrops = statements.filter(s => /\bDROP\b/i.test(s) && !dataLoss.includes(s));
const additive = statements.filter(s => !dataLoss.includes(s) && !otherDrops.includes(s));

console.log(`O db push executaria ${statements.length} instrução(ões):`);
console.log(`  aditivas (seguras): ${additive.length}`);
console.log(`  remoções de índice/constraint/default: ${otherDrops.length}`);
console.log(`  com risco de perda de dados: ${dataLoss.length}\n`);
for (const s of additive) console.log(`  + ${s.split('\n')[0]}`);
for (const s of otherDrops) console.log(`  ~ ${s.split('\n')[0]}`);
for (const s of dataLoss) console.log(`  ! ${s.split('\n')[0]}`);

if (dataLoss.length > 0) {
  console.error('\nNÃO rode o db push: ele apagaria dados. Ajuste o schema.prisma ou crie uma migration explícita.');
  process.exit(1);
}
