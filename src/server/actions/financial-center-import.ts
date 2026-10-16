'use server';

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import prisma from '@/infra/database/prisma';
import { withPermission } from '@/infra/auth/session';
import { ValidationError } from '@/core/errors/domain-errors';
import { runAction } from '@/shared/actions/action-result';
import { CENTER_IMPORT_MAX_BYTES, type CenterImportPreview } from '@/shared/data/financial-center-import';
import { parseFinancialCenterWorkbook } from '@/server/services/financial-center-import-parser';

async function readWorkbook(form: FormData) {
  const file = form.get('file');
  if (!(file instanceof File) || !/\.(xlsx|xls)$/i.test(file.name)) throw new ValidationError('Selecione uma planilha Excel (.xlsx ou .xls).');
  if (!file.size || file.size > CENTER_IMPORT_MAX_BYTES) throw new ValidationError('A planilha deve conter dados e ter até 2 MB.');
  const mode = z.enum(['BOTH', 'INCOME', 'EXPENSE']).parse(form.get('mode') ?? 'BOTH');
  let selectedSheets: string[] | undefined;
  if (form.has('sheets')) {
    try { selectedSheets = z.array(z.string().min(1)).min(1).max(50).parse(JSON.parse(String(form.get('sheets')))); }
    catch { throw new ValidationError('Selecione pelo menos uma aba válida para importar.'); }
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  return { bytes, mode, selectedSheets, fingerprint: createHash('sha256').update(bytes).update(mode).update(JSON.stringify(selectedSheets ?? null)).digest('hex') };
}

export async function previewFinancialCentersImportAction(form: FormData) {
  return runAction(() => withPermission('financial-centers', 'create', async session => {
    const { bytes, mode, selectedSheets, fingerprint } = await readWorkbook(form);
    const existing = await prisma.center.findMany({ where: { company_id: session.company_id, deleted_at: null }, select: { name: true, type: true } });
    const company = await prisma.company.findFirst({ where: { id: session.company_id }, select: { name: true } });
    const preview: CenterImportPreview = { ...parseFinancialCenterWorkbook(bytes, mode, existing, selectedSheets), companyId: session.company_id, companyName: company?.name ?? 'Empresa atual', fingerprint };
    return preview;
  }));
}

export async function importFinancialCentersAction(form: FormData) {
  return runAction(() => withPermission('financial-centers', 'create', async session => {
    const { bytes, mode, selectedSheets, fingerprint } = await readWorkbook(form);
    if (form.get('companyId') !== session.company_id || form.get('fingerprint') !== fingerprint) throw new ValidationError('A empresa ou o arquivo mudou. Gere a prévia novamente antes de importar.');
    // Parse again and check current tenant records inside the atomic transaction.
    // Serializable isolation prevents simultaneous uploads from adding duplicates.
    let result: { created: number; ignored: number } | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        result = await prisma.$transaction(async tx => {
          const existing = await tx.center.findMany({ where: { company_id: session.company_id, deleted_at: null }, select: { name: true, type: true } });
          const plan = parseFinancialCenterWorkbook(bytes, mode, existing, selectedSheets);
          if (plan.issues.length) throw new ValidationError('Corrija os erros da planilha e gere a prévia novamente.', plan.issues.slice(0, 20).map(issue => `${issue.sheet}, linha ${issue.line}: ${issue.message}`));
          const data = plan.rows.filter(row => row.status === 'new').map(row => ({ name: row.name, type: row.type, company_id: session.company_id, is_active: true }));
          if (data.length) await tx.center.createMany({ data });
          return { created: data.length, ignored: plan.existingCount + plan.duplicateCount };
        }, { isolationLevel: 'Serializable', timeout: 30000 });
        break;
      } catch (error) {
        if ((error as { code?: string })?.code !== 'P2034' || attempt === 2) throw error;
      }
    }
    revalidatePath('/dashboard/centros');
    return result!;
  }));
}
