import { readFileSync, writeFileSync } from 'node:fs';

// Store only the scalar types and FK metadata needed for portable JSON files.
// Regenerate after schema changes with npm run generate:table-models.
const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
const enums = Object.fromEntries([...schema.matchAll(/enum\s+(\w+)\s*\{([^}]+)\}/g)].map(([, name, body]) =>
  [name, body.split('\n').map(line => line.trim().split(/\s/)[0]).filter(value => value && !value.startsWith('//'))]));
const models = Object.fromEntries([...schema.matchAll(/model\s+(\w+)\s*\{([^}]+)\}/g)].map(([, name, body]) => {
  const fields = [];
  const relations = [];
  for (const line of body.split('\n')) {
    const match = line.trim().match(/^(\w+)\s+(\w+)(\[\]|\?)?\s*(.*)$/);
    if (!match || line.trim().startsWith('//')) continue;
    const [, field, type, modifier, attrs] = match;
    const relation = attrs.match(/@relation\(.*fields:\s*\[([^\]]+)\].*references:\s*\[([^\]]+)\]/);
    if (relation) relations.push({ model: type, fields: relation[1].split(',').map(v => v.trim()), references: relation[2].split(',').map(v => v.trim()) });
    if (!['String', 'Int', 'Float', 'Decimal', 'Boolean', 'DateTime', 'Json', 'BigInt'].includes(type) && !enums[type]) continue;
    fields.push({ name: field, type, list: modifier === '[]', required: modifier !== '?' && !attrs.includes('@default(') && !attrs.includes('@updatedAt'), nullable: modifier === '?', ...(enums[type] ? { values: enums[type] } : {}) });
  }
  return [name, { fields, relations }];
}));
const output = new URL('../src/shared/data/table-transfer-models.json', import.meta.url);
const content = JSON.stringify(models, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (readFileSync(output, 'utf8') !== content) throw new Error('Execute npm run generate:table-models para atualizar os metadados.');
} else writeFileSync(output, content);
