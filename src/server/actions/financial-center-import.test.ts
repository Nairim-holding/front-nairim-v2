import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { ForbiddenError } from '@/core/errors/domain-errors';
const mocks = vi.hoisted(() => ({ permission: vi.fn(), findMany: vi.fn(), createMany: vi.fn(), company: vi.fn(), transaction: vi.fn(), revalidate: vi.fn() }));
vi.mock('@/infra/auth/session', () => ({ withPermission: mocks.permission }));
vi.mock('@/infra/database/prisma', () => ({ default: { center: { findMany: mocks.findMany }, company: { findFirst: mocks.company }, $transaction: mocks.transaction } }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
import { importFinancialCentersAction, previewFinancialCentersImportAction } from './financial-center-import';

function upload(rows: unknown[][] = [['Nome'], ['Centro A'], ['Centro A']]) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Centros');
  const bytes = new Uint8Array(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }));
  const form = new FormData(); form.set('file', new File([bytes], 'centros.xlsx')); form.set('mode', 'BOTH');
  return form;
}
async function reviewed(form: FormData) {
  const preview = await previewFinancialCentersImportAction(form);
  if (!preview.ok) throw new Error(preview.error);
  form.set('companyId', preview.data.companyId); form.set('fingerprint', preview.data.fingerprint);
  return preview.data;
}

describe('importação de centros com autorização e isolamento por empresa', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.permission.mockImplementation(async (_resource, _action, callback) => callback({ company_id: 'company-a' }));
    mocks.findMany.mockResolvedValue([]); mocks.company.mockResolvedValue({ name: 'Empresa atual' });
    mocks.createMany.mockResolvedValue({ count: 2 });
    mocks.transaction.mockImplementation(async callback => callback({ center: { findMany: mocks.findMany, createMany: mocks.createMany } }));
  });

  it('a prévia usa a empresa da sessão e nunca grava centros', async () => {
    const result = await previewFinancialCentersImportAction(upload());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({ companyId: 'company-a', companyName: 'Empresa atual', newCount: 2, duplicateCount: 2 });
    expect(mocks.findMany).toHaveBeenCalledWith({ where: { company_id: 'company-a', deleted_at: null }, select: { name: true, type: true } });
    expect(mocks.permission).toHaveBeenCalledWith('financial-centers', 'create', expect.any(Function));
    expect(mocks.transaction).not.toHaveBeenCalled(); expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it('insere somente novos centros na empresa atual em uma transação serializável', async () => {
    const form = upload(); await reviewed(form);
    const result = await importFinancialCentersAction(form);
    expect(result).toEqual({ ok: true, data: { created: 2, ignored: 2 } });
    expect(mocks.createMany).toHaveBeenCalledWith({ data: [
      { name: 'Centro A (CR)', type: 'INCOME', company_id: 'company-a', is_active: true },
      { name: 'Centro A (DB)', type: 'EXPENSE', company_id: 'company-a', is_active: true },
    ] });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable', timeout: 30000 });
  });

  it('relê o cadastro ao confirmar e não duplica o centro criado depois da prévia', async () => {
    const form = upload(); await reviewed(form);
    mocks.findMany.mockResolvedValue([{ name: 'Centro A (CR)', type: 'INCOME' }, { name: 'Centro A (DB)', type: 'EXPENSE' }]);
    expect(await importFinancialCentersAction(form)).toEqual({ ok: true, data: { created: 0, ignored: 4 } });
    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it('bloqueia uma mudança de empresa ou de arquivo após a prévia', async () => {
    const form = upload(); await reviewed(form);
    form.set('companyId', 'company-b');
    expect((await importFinancialCentersAction(form)).ok).toBe(false);
    form.set('companyId', 'company-a'); form.set('mode', 'INCOME');
    expect((await importFinancialCentersAction(form)).ok).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('revalida erros antes de gravar e exige uma prévia para o mesmo arquivo', async () => {
    const form = upload([['Nome', 'Tipo'], ['Centro A', 'CR'], ['Centro B', 'Inválido']]);
    expect((await importFinancialCentersAction(form)).ok).toBe(false);
    const preview = await reviewed(form); expect(preview.issues).toHaveLength(1);
    expect((await importFinancialCentersAction(form)).ok).toBe(false);
    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it('autoriza a operação antes de ler arquivo ou consultar centros', async () => {
    mocks.permission.mockRejectedValue(new ForbiddenError());
    expect(await previewFinancialCentersImportAction(upload())).toMatchObject({ ok: false, status: 403 });
    expect(await importFinancialCentersAction(upload())).toMatchObject({ ok: false, status: 403 });
    expect(mocks.findMany).not.toHaveBeenCalled(); expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('refaz a transação após conflito de concorrência', async () => {
    const form = upload(); await reviewed(form);
    mocks.transaction.mockRejectedValueOnce({ code: 'P2034' });
    expect((await importFinancialCentersAction(form)).ok).toBe(true);
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
  });

  it('rejeita extensão, tamanho e lista de abas inválidos sem gravar', async () => {
    const form = upload(); form.set('file', new File(['Nome'], 'arquivo.csv'));
    expect((await previewFinancialCentersImportAction(form)).ok).toBe(false);
    form.set('file', new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'grande.xlsx'));
    expect((await previewFinancialCentersImportAction(form)).ok).toBe(false);
    const emptySheets = upload(); emptySheets.set('sheets', '[]');
    expect((await previewFinancialCentersImportAction(emptySheets)).ok).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
