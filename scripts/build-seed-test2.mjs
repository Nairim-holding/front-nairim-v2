import { rolldown } from 'rolldown';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const bcryptDirectory = dirname(require.resolve('bcryptjs/package.json'));
const license = readFileSync(join(bcryptDirectory,'LICENSE'),'utf8').replace(/\r\n/g,'\n');
const bundle = await rolldown({
  cwd: root, input: 'scripts/seed-test2.source.mjs', platform: 'node',
  external: id => id === 'pg' || id.startsWith('node:') || id === 'crypto',
});
try {
  const result = await bundle.generate({
    format: 'esm',
    banner: `/* eslint-disable */\n/* Arquivo gerado por npm run build:seed-test2. Edite seed-test2.source.mjs.\n\nBiblioteca bcryptjs incorporada com sua licença:\n${license}\n*/`,
  });
  const output = result.output.find(item => item.type === 'chunk');
  if (!output || result.output.length !== 1) throw new Error('O seed deve ser um único arquivo executável.');
  const code = output.code.replace(/\r\n/g,'\n');
  const target = join(root,'scripts/seed-test2.mjs');
  if (process.argv.includes('--check')) {
    if (readFileSync(target,'utf8').replace(/\r\n/g,'\n') !== code) throw new Error('Seed gerado desatualizado. Execute npm run build:seed-test2 e registre o arquivo.');
    console.log('Seed da VPS corresponde à fonte e inclui bcryptjs.');
  } else {
    writeFileSync(target,code,'utf8');
    console.log('scripts/seed-test2.mjs gerado com bcryptjs incorporado.');
  }
} finally { await bundle.close(); }
