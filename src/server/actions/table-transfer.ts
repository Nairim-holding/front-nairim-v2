'use server';

import { z } from 'zod';
import { exportAllTableData, previewAllTableImport, importAllTableData } from '@/server/services/table-transfer-batch';
import { revalidatePath } from 'next/cache';
import { withPermission, assertAdmin, assertSuperAdmin } from '@/infra/auth/session';
import { tableTransferRepository } from '@/infra/repositories/prisma-table-transfer-repository';
import { getTransferTable, TABLE_TRANSFER_MAX_BYTES, type TransferTable, type TableTransferImportResult } from '@/shared/data/table-transfer';
import { parseTableTransfer } from '@/shared/validators/table-transfer';
import { runAction } from '@/shared/actions/action-result';
import { ValidationError } from '@/core/errors/domain-errors';
import type { DecodedSessionToken } from '@/core/cryptography/token-signer';

function tableFor(key: string) {
  const table = getTransferTable(key);
  if (!table) throw new ValidationError('Cadastro não permitido para transferência.');
  return table;
}
function authorizeSensitive(table: TransferTable, session: DecodedSessionToken) {
  if (table.global) assertSuperAdmin(session);
  else if (table.admin) assertAdmin(session);
}
async function readFile(form: FormData) {
  const file = form.get('file');
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.json')) throw new ValidationError('Selecione um arquivo JSON exportado pelo sistema.');
  if (!file.size || file.size > TABLE_TRANSFER_MAX_BYTES) throw new ValidationError('O JSON deve ter até 40 MB.');
  try { return JSON.parse(await file.text()) as unknown; }
  catch { throw new ValidationError('Não foi possível ler o JSON. Verifique o arquivo.'); }
}
export async function exportTableDataAction(key: string, scope: 'current' | 'all' = 'current') {
  return runAction(async () => {
    const table = tableFor(key);
    return withPermission(table.resource, 'export', session => {
      authorizeSensitive(table, session);
      z.enum(['current', 'all']).parse(scope);
      if (scope === 'all') { assertSuperAdmin(session); return exportAllTableData(table, session); }
      return tableTransferRepository.export(table, session.company_id).then(payload => JSON.stringify(payload, (_key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
    });
  });
}
export async function previewTableImportAction(key: string, form: FormData) {
  return runAction(async () => {
    const table = tableFor(key);
    return withPermission(table.resource, 'create', session => withPermission(table.resource, 'edit', async () => {
      authorizeSensitive(table, session);
      const mode = z.enum(['current', 'copy-all', 'restore-all']).parse(form.get('mode') ?? 'current');
      if (mode !== 'current') { assertSuperAdmin(session); return previewAllTableImport(table, await readFile(form), mode, session); }
      const { payload } = parseTableTransfer(await readFile(form), key);
      return { label: table.label, counts: payload.meta.counts, total: Object.values(payload.data).reduce((sum, rows) => sum + rows.length, 0), dependencies: payload.meta.dependencies };
    }));
  });
}
export async function importTableDataAction(key: string, form: FormData) {
  return runAction<TableTransferImportResult>(async () => {
    const table = tableFor(key);
    return withPermission(table.resource, 'create', session => withPermission(table.resource, 'edit', async () => {
      authorizeSensitive(table, session);
      const mode = z.enum(['current', 'copy-all', 'restore-all']).parse(form.get('mode') ?? 'current');
      if (mode !== 'current') {
        assertSuperAdmin(session);
        const result = await importAllTableData(table, await readFile(form), mode, session);
        revalidatePath('/dashboard', 'layout');
        return result;
      }
      const { payload } = parseTableTransfer(await readFile(form), key);
      const result = await tableTransferRepository.import(table, payload, session.company_id, session.id, session.role === 'SUPER_ADMIN');
      revalidatePath('/dashboard', 'layout');
      return result;
    }));
  });
}
