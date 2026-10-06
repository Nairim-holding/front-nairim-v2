import { z } from 'zod';
import modelMetadata from '@/shared/data/table-transfer-models.json';
import { getTransferTable, TABLE_TRANSFER_FORMAT_VERSION, type TransferTable } from '@/shared/data/table-transfer';
import { ValidationError } from '@/core/errors/domain-errors';

export interface ModelField { name: string; type: string; list: boolean; required: boolean; nullable: boolean; values?: string[] }
export interface ModelMetadata { fields: ModelField[]; relations: { model: string; fields: string[]; references: string[] }[] }
export const transferModels = modelMetadata as Record<string, ModelMetadata>;
export type TransferRows = Record<string, Record<string, unknown>[]>;
export interface TableTransferPayload {
  meta: { app: 'nairim'; formatVersion: number; table: string; company_id: string; exportedAt: string; counts: Record<string, number>; dependencies: string[] };
  data: TransferRows;
}
const envelope = z.object({
  meta: z.object({ app: z.literal('nairim'), formatVersion: z.literal(TABLE_TRANSFER_FORMAT_VERSION), table: z.string(), company_id: z.string().min(1), exportedAt: z.string().datetime(), counts: z.record(z.number().int().min(0)), dependencies: z.array(z.string()).default([]) }),
  data: z.record(z.array(z.record(z.unknown())).max(100000)),
});
function fieldSchema(field: ModelField): z.ZodTypeAny {
  let schema: z.ZodTypeAny;
  if (field.values) schema = z.string().refine(value => field.values!.includes(value));
  else switch (field.type) {
    case 'String': schema = z.string().max(1000000); break;
    case 'Int': schema = z.number().int().min(-2147483648).max(2147483647); break;
    case 'Float': schema = z.number().finite(); break;
    case 'Decimal': schema = z.union([z.number().finite(), z.string().regex(/^-?\d+(\.\d+)?$/).max(100)]); break;
    case 'BigInt': schema = z.string().regex(/^-?\d+$/).max(30); break;
    case 'Boolean': schema = z.boolean(); break;
    case 'DateTime': schema = z.string().datetime({ offset: true }); break;
    case 'Json': schema = z.unknown(); break;
    default: throw new ValidationError(`Tipo de coluna não suportado: ${field.type}`);
  }
  if (field.list) schema = z.array(schema).max(10000);
  if (field.nullable) schema = schema.nullable();
  if (!field.required) schema = schema.optional();
  return schema;
}
export function parseTableTransfer(raw: unknown, expectedKey: string): { table: TransferTable; payload: TableTransferPayload } {
  const table = getTransferTable(expectedKey);
  if (!table) throw new ValidationError('Cadastro não permitido para transferência.');
  const result = envelope.safeParse(raw);
  if (!result.success) throw new ValidationError('JSON inválido ou versão de exportação incompatível.');
  const payload = result.data as TableTransferPayload;
  if (payload.meta.table !== table.key) throw new ValidationError(`Este arquivo não pertence ao cadastro ${table.label}.`);
  const allowed = new Set([table.model, ...table.children]);
  if (!Array.isArray(payload.data[table.model])) throw new ValidationError('A tabela principal está ausente do arquivo.');
  let count = 0;
  for (const [model, rows] of Object.entries(payload.data)) {
    if (!allowed.has(model)) throw new ValidationError(`O arquivo contém uma tabela não permitida: ${model}.`);
    count += rows.length;
    if (count > 100000) throw new ValidationError('Limite de 100.000 registros por importação.');
    if (payload.meta.counts[model] !== rows.length) throw new ValidationError(`Contagem de registros divergente em ${model}.`);
    const shape = Object.fromEntries(transferModels[model].fields.map(field => [field.name, fieldSchema(field)]));
    shape.id = z.string().min(1).max(200);
    const schema = z.object(shape).strict();
    const ids = new Set<string>();
    for (const [index, row] of rows.entries()) {
      const parsed = schema.safeParse(row);
      if (!parsed.success) throw new ValidationError(`Registro ${index + 1} de ${model}: campo ${parsed.error.issues[0].path.join('.') || 'desconhecido'} inválido.`);
      if (ids.has(String(row.id))) throw new ValidationError(`ID duplicado em ${model}: ${row.id}.`);
      ids.add(String(row.id));
    }
  }
  return { table, payload };
}
