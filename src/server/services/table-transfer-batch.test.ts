import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ companies: vi.fn(), export: vi.fn(), import: vi.fn(), audit: vi.fn(), transaction: vi.fn() }));
vi.mock('@/infra/database/prisma', () => ({ default: { company: { findMany: state.companies }, $transaction: state.transaction } }));
vi.mock('@/infra/repositories/prisma-table-transfer-repository', () => ({ tableTransferRepository: { export: state.export, import: state.import } }));
vi.mock('@/infra/auth/session', () => ({ assertSuperAdmin: (session: { role: string }) => { if (session.role !== 'SUPER_ADMIN') throw new Error('Somente root'); } }));
import { exportAllTableData, previewAllTableImport, importAllTableData } from './table-transfer-batch';
import { getAuditActor, runWithAuditActor } from '@/infra/database/audit-context';
import { getCurrentCompanyId, runWithTenant } from '@/infra/database/tenant-context';
import { getTransferTable } from '@/shared/data/table-transfer';
import { parseTableTransferBundle } from '@/shared/validators/table-transfer';
import { ValidationError } from '@/core/errors/domain-errors';
const session = { id: 'root', name: 'Root', email: 'root@test.local', role: 'SUPER_ADMIN', company_id: 'original', iat: 0, exp: 1 };
const table = getTransferTable('property-types')!;
const companies = ['a', 'b', 'c', 'd'].map(id => ({ id, name: `Empresa ${id}`, slug: `empresa-${id}` }));
const payload = (id: string) => ({ meta: { app: 'nairim' as const, formatVersion: 1, table: table.key, company_id: id, exportedAt: '2026-10-07T00:00:00.000Z', counts: { PropertyType: 1 }, dependencies: [] }, data: { PropertyType: [{ id: 'type-'+id, company_id: id, description: 'Casa '+id }] } });
const asRoot = <T>(fn: () => Promise<T>) => runWithTenant('original', () => runWithAuditActor({ ...session, ip: '127.0.0.1' }, fn));
let running: number; let peak: number;
beforeEach(() => {
  vi.resetAllMocks(); running = 0; peak = 0;
  state.companies.mockResolvedValue(companies);
  state.transaction.mockImplementation(async fn => fn({ auditLogOutbox: { create: state.audit } }));
  state.audit.mockResolvedValue({});
  state.export.mockImplementation(async (_table, id) => {
    expect(getCurrentCompanyId()).toBe(id); expect(getAuditActor()).toMatchObject({ id: 'root', company_id: id, ip: '127.0.0.1' });
    running++; peak = Math.max(peak, running); await new Promise(resolve => setTimeout(resolve, 3)); running--;
    return payload(id);
  });
  state.import.mockImplementation(async (_table, _payload, id, actor, root) => {
    expect(getCurrentCompanyId()).toBe(id); expect(getAuditActor()).toMatchObject({ id: 'root', company_id: id }); expect(actor).toBe('root'); expect(root).toBe(true);
    return { created: 1, updated: 0 };
  });
});
it('exporta cada empresa separada, limita concorrência e registra todos os logs com o autor correto', async () => {
  const bundle = parseTableTransferBundle(JSON.parse(await asRoot(() => exportAllTableData(table, session))), table.key);
  expect(bundle.companies.map(entry => entry.payload.meta.company_id)).toEqual(['a','b','c','d']);
  expect(bundle.meta.recordCount).toBe(4); expect(peak).toBe(3);
  expect(state.export).toHaveBeenCalledWith(table, 'b', false);
  expect(state.audit.mock.calls.map(call => call[0].data.company_id)).toEqual(['a','b','c','d']);
  expect(state.audit.mock.calls.every(call => call[0].data.user_id === 'root' && call[0].data.ip === '127.0.0.1')).toBe(true);
  expect(getCurrentCompanyId()).toBeUndefined(); expect(getAuditActor()).toBeUndefined();
});
it('exportação recusada ou incompleta não grava logs de conclusão', async () => {
  await expect(asRoot(() => exportAllTableData(table, { ...session, role: 'ADMIN' }))).rejects.toThrow('root');
  expect(state.companies).not.toHaveBeenCalled();
  state.export.mockRejectedValue(new Error('leitura falhou'));
  await expect(asRoot(() => exportAllTableData(table, session))).rejects.toThrow('leitura falhou');
  expect(state.audit).not.toHaveBeenCalled();
});
it('não publica arquivo que excede o limite conjunto', async () => {
  state.export.mockResolvedValue({ ...payload('a'), meta: { ...payload('a').meta, counts: { PropertyType: 30000 } } });
  await expect(asRoot(() => exportAllTableData(table, session))).rejects.toThrow('excede');
  expect(state.audit).not.toHaveBeenCalled();
});
it('prévia da cópia descreve todas as empresas sem gravar dados', async () => {
  const result = await asRoot(() => previewAllTableImport(table, payload('source'), 'copy-all', session));
  expect(result.companyCount).toBe(4); expect(result.total).toBe(4); expect(result.counts).toEqual({ PropertyType: 4 });
  expect(state.import).not.toHaveBeenCalled(); expect(state.audit).not.toHaveBeenCalled();
});
it('copia o mesmo arquivo para todas e retorna falha explícita por empresa, mantendo o contexto das demais', async () => {
  state.import.mockImplementation(async (_table, _payload, id) => {
    await new Promise(resolve => setTimeout(resolve, 3)); expect(getCurrentCompanyId()).toBe(id); expect(getAuditActor()?.company_id).toBe(id);
    if (id === 'b') throw new ValidationError('Dependência ausente'); return { created: 1, updated: 2 };
  });
  const result = await asRoot(() => importAllTableData(table, payload('source'), 'copy-all', session));
  expect(result.created).toBe(3); expect(result.updated).toBe(6);
  expect(result.results.find(row => row.slug === 'empresa-b')).toMatchObject({ ok: false, created: 0, updated: 0, error: 'Dependência ausente' });
  expect(result.results.filter(row => row.ok)).toHaveLength(3);
});
it('restaura somente dados próprios das empresas pelo slug, mesmo quando IDs mudam entre ambientes', async () => {
  const bundle = JSON.parse(await asRoot(() => exportAllTableData(table, session)));
  state.companies.mockResolvedValue(companies.map(company => ({ ...company, id: 'new-'+company.id })));
  await asRoot(() => importAllTableData(table, bundle, 'restore-all', session));
  for (const [index, call] of state.import.mock.calls.entries()) {
    expect(call[1].meta.company_id).toBe(companies[index].id); expect(call[2]).toBe('new-'+companies[index].id);
    expect(call[1].data.PropertyType[0].description).toBe('Casa '+companies[index].id);
  }
});
it('recusa empresas faltantes e arquivos do modo errado antes de qualquer importação', async () => {
  const bundle = JSON.parse(await asRoot(() => exportAllTableData(table, session)));
  state.companies.mockResolvedValue(companies.slice(0,2));
  await expect(asRoot(() => importAllTableData(table, bundle, 'restore-all', session))).rejects.toThrow('empresa-c');
  await expect(asRoot(() => importAllTableData(table, payload('a'), 'restore-all', session))).rejects.toThrow('Todas as empresas');
  await expect(asRoot(() => importAllTableData(table, bundle, 'copy-all', session))).rejects.toThrow('incompatível');
  expect(state.import).not.toHaveBeenCalled();
});
it('recusa bundle duplicado, contagem falsa e mistura de dados entre empresas', async () => {
  const bundle = JSON.parse(await asRoot(() => exportAllTableData(table, session)));
  const duplicate = structuredClone(bundle); duplicate.companies[1] = duplicate.companies[0];
  expect(() => parseTableTransferBundle(duplicate, table.key)).toThrow('duplicada');
  const mixed = structuredClone(bundle); mixed.companies[0].payload.data.PropertyType[0].company_id = 'b';
  expect(() => parseTableTransferBundle(mixed, table.key)).toThrow('não correspondem');
  bundle.meta.recordCount = 99; expect(() => parseTableTransferBundle(bundle, table.key)).toThrow('divergentes');
});
