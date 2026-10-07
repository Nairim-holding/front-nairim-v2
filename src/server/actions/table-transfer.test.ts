import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ denied: '', role: 'ADMIN', permission: vi.fn(), export: vi.fn(), import: vi.fn(), revalidate: vi.fn(), exportAll: vi.fn(), previewAll: vi.fn(), importAll: vi.fn() }));
vi.mock('@/infra/auth/session', () => ({
  withPermission: async (resource: string, action: string, callback: (session: object) => unknown) => {
    state.permission(resource, action);
    if (state.denied === action) throw new Error('Permissão recusada');
    return callback({ id: 'actor', company_id: 'destination', role: state.role });
  },
  assertAdmin: (session: {role: string}) => { if (!['ADMIN', 'SUPER_ADMIN'].includes(session.role)) throw new Error('Administrador necessário'); },
  assertSuperAdmin: (session: {role: string}) => { if (session.role !== 'SUPER_ADMIN') throw new Error('Super administrador necessário'); },
}));
vi.mock('@/infra/repositories/prisma-table-transfer-repository', () => ({ tableTransferRepository: { export: state.export, import: state.import } }));
vi.mock('@/server/services/table-transfer-batch', () => ({ exportAllTableData: state.exportAll, previewAllTableImport: state.previewAll, importAllTableData: state.importAll }));
vi.mock('next/cache', () => ({ revalidatePath: state.revalidate }));
import { exportTableDataAction, previewTableImportAction, importTableDataAction } from './table-transfer';
const data = { meta: { app: 'nairim', formatVersion: 1, table: 'property-types', company_id: 'source', exportedAt: '2026-10-05T00:00:00.000Z', counts: { PropertyType: 1 }, dependencies: [] }, data: { PropertyType: [{ id: 'type', company_id: 'source', description: 'Casa' }] } };
function file(raw: unknown = data, name = 'tipos.json') {
  const form = new FormData(); form.set('file', new File([JSON.stringify(raw)], name, { type: 'application/json' })); return form;
}
describe('Permissões e validação na transferência de tabelas', () => {
  beforeEach(() => { vi.clearAllMocks(); state.denied = ''; state.role = 'ADMIN'; state.export.mockResolvedValue(data); state.import.mockResolvedValue({ created: 1, updated: 0 }); });
  it('exporta o JSON somente com a permissão de exportar e o contexto da sessão', async () => {
    const result = await exportTableDataAction('property-types');
    expect(result.ok && JSON.parse(result.data)).toEqual(data);
    expect(state.permission).toHaveBeenCalledWith('property-types', 'export');
    expect(state.export).toHaveBeenCalledWith(expect.objectContaining({ key: 'property-types' }), 'destination');
  });
  it('recusa exportação antes de consultar o banco quando falta permissão', async () => {
    state.denied = 'export';
    expect((await exportTableDataAction('property-types')).ok).toBe(false);
    expect(state.export).not.toHaveBeenCalled();
  });
  it('exige criar e editar na prévia e na importação', async () => {
    state.denied = 'edit';
    expect((await previewTableImportAction('property-types', file())).ok).toBe(false);
    expect((await importTableDataAction('property-types', file())).ok).toBe(false);
    expect(state.permission).toHaveBeenCalledWith('property-types', 'create');
    expect(state.permission).toHaveBeenCalledWith('property-types', 'edit');
    expect(state.import).not.toHaveBeenCalled();
  });
  it('a prévia valida e mostra contagens sem gravar dados', async () => {
    const result = await previewTableImportAction('property-types', file());
    expect(result).toMatchObject({ ok: true, data: { label: 'Tipos de imóvel', total: 1, counts: { PropertyType: 1 } } });
    expect(state.import).not.toHaveBeenCalled();
  });
  it('recusa JSON da tabela errada e arquivo não JSON', async () => {
    expect((await importTableDataAction('owners', file())).ok).toBe(false);
    expect((await previewTableImportAction('property-types', file(data, 'arquivo.txt'))).ok).toBe(false);
    expect(state.import).not.toHaveBeenCalled();
  });
  it('valida o arquivo novamente ao confirmar e atualiza o dashboard após gravar', async () => {
    const result = await importTableDataAction('property-types', file());
    expect(result).toMatchObject({ ok: true, data: { created: 1, updated: 0 } });
    expect(state.import).toHaveBeenCalledWith(expect.objectContaining({ key: 'property-types' }), data, 'destination', 'actor', false);
    expect(state.revalidate).toHaveBeenCalledWith('/dashboard', 'layout');
  });
  it('reserva transferência de empresas a super administradores e usuários a administradores', async () => {
    expect((await exportTableDataAction('companies')).ok).toBe(false);
    state.role = 'DEFAULT';
    expect((await exportTableDataAction('users')).ok).toBe(false);
    expect(state.export).not.toHaveBeenCalled();
  });
});

it('recusa todas as operações coletivas para administradores comuns antes de ler outras empresas', async () => {
  state.role = 'ADMIN';
  const form = file(); form.set('mode', 'copy-all');
  expect((await exportTableDataAction('property-types', 'all')).ok).toBe(false);
  expect((await previewTableImportAction('property-types', form)).ok).toBe(false);
  expect((await importTableDataAction('property-types', form)).ok).toBe(false);
  expect(state.exportAll).not.toHaveBeenCalled(); expect(state.previewAll).not.toHaveBeenCalled(); expect(state.importAll).not.toHaveBeenCalled();
});
it('root pode selecionar o fluxo coletivo e opções adulteradas são recusadas', async () => {
  state.role = 'SUPER_ADMIN'; state.exportAll.mockResolvedValue('bundle'); state.previewAll.mockResolvedValue({ total: 1 }); state.importAll.mockResolvedValue({ results: [] });
  expect(await exportTableDataAction('property-types', 'all')).toMatchObject({ ok: true, data: 'bundle' });
  const form = file(); form.set('mode', 'restore-all');
  expect((await previewTableImportAction('property-types', form)).ok).toBe(true);
  expect((await importTableDataAction('property-types', form)).ok).toBe(true);
  expect(state.importAll).toHaveBeenCalledWith(expect.objectContaining({ key: 'property-types' }), data, 'restore-all', expect.objectContaining({ role: 'SUPER_ADMIN' }));
  form.set('mode', 'invalid'); expect((await importTableDataAction('property-types', form)).ok).toBe(false);
  expect((await exportTableDataAction('property-types', 'invalid' as 'all')).ok).toBe(false);
});
