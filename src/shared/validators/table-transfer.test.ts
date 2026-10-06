import { describe, expect, it } from 'vitest';
import { parseTableTransfer, transferModels } from './table-transfer';
import { TRANSFER_TABLES, transferTablesForPath } from '@/shared/data/table-transfer';
import { execFileSync } from 'node:child_process';

const payload = () => ({ meta: { app: 'nairim', formatVersion: 1, table: 'property-types', company_id: 'source', exportedAt: '2026-10-05T00:00:00.000Z', counts: { PropertyType: 1 }, dependencies: [] },
  data: { PropertyType: [{ id: 'type', company_id: 'source', description: 'Casa', created_at: '2026-10-05T00:00:00.000Z' }] } });
describe('JSON de transferência de tabelas', () => {
  it('aceita arquivo do cadastro escolhido com datas e IDs preservados', () => {
    expect(parseTableTransfer(payload(), 'property-types').payload.data.PropertyType[0]).toMatchObject({ id: 'type', company_id: 'source', description: 'Casa' });
  });
  it('recusa arquivo de outra tabela, versão incompatível e cadastro desconhecido', () => {
    expect(() => parseTableTransfer(payload(), 'owners')).toThrow('não pertence');
    const invalid = payload(); invalid.meta.formatVersion = 2;
    expect(() => parseTableTransfer(invalid, 'property-types')).toThrow('incompatível');
    expect(() => parseTableTransfer(payload(), 'audit-log')).toThrow('não permitido');
  });
  it('recusa tabelas extras, relações de escrita aninhadas e campos obrigatórios ausentes', () => {
    const extraTable = { ...payload(), data: { ...payload().data, User: [] } };
    expect(() => parseTableTransfer(extraTable, 'property-types')).toThrow('não permitida');
    const extraField = payload(); Object.assign(extraField.data.PropertyType[0], { properties: { create: {} } });
    expect(() => parseTableTransfer(extraField, 'property-types')).toThrow('inválido');
    const missing = payload(); delete (missing.data.PropertyType[0] as Record<string, unknown>).description;
    expect(() => parseTableTransfer(missing, 'property-types')).toThrow('description');
  });
  it('recusa IDs duplicados e contagens divergentes', () => {
    const duplicate = payload(); duplicate.data.PropertyType.push(duplicate.data.PropertyType[0]); duplicate.meta.counts.PropertyType = 2;
    expect(() => parseTableTransfer(duplicate, 'property-types')).toThrow('duplicado');
    const count = payload(); count.meta.counts.PropertyType = 3;
    expect(() => parseTableTransfer(count, 'property-types')).toThrow('divergente');
  });
  it('mapeia somente as listagens e aceita o prefixo da empresa', () => {
    expect(transferTablesForPath('/empresa/dashboard/reparos')[0].key).toBe('repairs');
    expect(transferTablesForPath('/dashboard/imoveis/')[0].key).toBe('properties');
    expect(transferTablesForPath('/dashboard/administradores/editar/id')).toEqual([]);
    expect(transferTablesForPath('/dashboard/locacoes/relatorios')).toEqual([]);
    expect(transferTablesForPath('/dashboard/lancamentos').map(table => table.key)).toContain('transactions');
  });
  it('todos os cadastros e filhos possuem metadados de campos e relações', () => {
    for (const table of TRANSFER_TABLES) for (const model of [table.model, ...table.children]) expect(transferModels[model].fields.some(field => field.name === 'id')).toBe(true);
  });
  it('os metadados estão atualizados com o schema do banco', () => {
    expect(() => execFileSync(process.execPath, ['scripts/generate-table-transfer-models.mjs', '--check'])).not.toThrow();
  });
});
