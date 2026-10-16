import * as XLSX from 'xlsx';
import { ValidationError } from '@/core/errors/domain-errors';
import type { TransactionType } from '@/core/entities/category';
import { CENTER_IMPORT_MAX_ROWS, type CenterImportMode, type CenterImportPlan, type CenterImportRow } from '@/shared/data/financial-center-import';

type ExistingCenter = { name: string; type: TransactionType };
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
const NAME_HEADERS = new Set(['nome', 'endereco', 'centro', 'nome do centro', 'centro de custo', 'centro de custos', 'centro de receita', 'centro de despesa']);
const TYPE_HEADERS = new Set(['tipo', 'type', 'natureza']);

export function financialCenterImportName(name: string, type: TransactionType) {
  const base = name.trim().replace(/\s+/g, ' ').replace(/(?:\s*\((?:CR|DB)\))+\s*$/i, '').trim();
  return base ? `${base} (${type === 'INCOME' ? 'CR' : 'DB'})` : '';
}

function identity(center: ExistingCenter) {
  return `${center.type}:${normalize(financialCenterImportName(center.name, center.type))}`;
}

function parseType(value: string): TransactionType | undefined {
  const type = normalize(value).replace(/[()]/g, '');
  if (['income', 'receita', 'credito', 'cr'].includes(type)) return 'INCOME';
  if (['expense', 'despesa', 'debito', 'db'].includes(type)) return 'EXPENSE';
}

/** Reads names only. Workbook tab names never select a company or create links. */
export function parseFinancialCenterWorkbook(bytes: Uint8Array, mode: CenterImportMode, existing: ExistingCenter[] = [], selectedSheets?: string[]): CenterImportPlan {
  const zip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const ole = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((byte, index) => bytes[index] === byte);
  if (!zip && !ole) throw new ValidationError('Selecione um arquivo Excel válido (.xlsx ou .xls).');
  let workbook: XLSX.WorkBook;
  try { workbook = XLSX.read(bytes, { type: 'array', cellFormula: true, sheetRows: CENTER_IMPORT_MAX_ROWS + 51 }); }
  catch { throw new ValidationError('Não foi possível ler a planilha. Selecione um Excel válido (.xlsx ou .xls).'); }
  if (!workbook.SheetNames.length || workbook.SheetNames.length > 50) throw new ValidationError('A planilha deve conter de 1 a 50 abas.');
  const selected = selectedSheets ?? workbook.SheetNames;
  if (!selected.length || selected.some(name => !workbook.SheetNames.includes(name))) throw new ValidationError('Selecione pelo menos uma aba válida para importar.');
  const plan: CenterImportPlan = { sheets: workbook.SheetNames, selectedSheets: [...new Set(selected)], rows: [], issues: [], sourceRows: 0, newCount: 0, existingCount: 0, duplicateCount: 0 };
  const saved = new Set(existing.map(identity));
  const seen = new Set<string>();
  for (const sheetName of workbook.SheetNames.filter(name => selected.includes(name))) {
    const sheet = workbook.Sheets[sheetName];
    const reference = sheet['!fullref'] ?? sheet['!ref'];
    if (!reference) continue;
    const range = XLSX.utils.decode_range(reference);
    if (range.e.r >= CENTER_IMPORT_MAX_ROWS + 50 || range.e.c >= 100) throw new ValidationError(`A aba "${sheetName}" excede 5.050 linhas ou 100 colunas.`);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', blankrows: true, raw: true, range: 0 });
    const headerIndex = rows.slice(0, 50).findIndex(row => row.some(cell => typeof cell === 'string' && NAME_HEADERS.has(normalize(cell))));
    if (headerIndex < 0) {
      if (rows.some(row => row.some(cell => String(cell ?? '').trim()))) plan.issues.push({ sheet: sheetName, line: 1, message: 'Cabeçalho não encontrado. Use uma coluna Nome ou Endereço.' });
      continue;
    }
    const header = rows[headerIndex];
    const nameIndex = header.findIndex(cell => typeof cell === 'string' && NAME_HEADERS.has(normalize(cell)));
    const typeIndex = header.findIndex(cell => typeof cell === 'string' && TYPE_HEADERS.has(normalize(cell)));
    for (let index = headerIndex + 1; index < rows.length; index++) {
      const row = rows[index];
      if (!row.some(cell => String(cell ?? '').trim())) continue;
      plan.sourceRows++;
      if (plan.sourceRows > CENTER_IMPORT_MAX_ROWS) throw new ValidationError('Importe no máximo 5.000 linhas por arquivo.');
      const line = index + 1;
      const rawName = row[nameIndex];
      const rawType = typeIndex < 0 ? '' : String(row[typeIndex] ?? '').trim();
      const nameCell = sheet[XLSX.utils.encode_cell({ r: index, c: nameIndex })];
      const typeCell = typeIndex < 0 ? undefined : sheet[XLSX.utils.encode_cell({ r: index, c: typeIndex })];
      if (nameCell?.f || typeCell?.f) {
        plan.issues.push({ sheet: sheetName, line, message: 'Nome e Tipo devem conter valores, sem fórmulas.' });
        continue;
      }
      if (typeof rawName !== 'string' || !rawName.trim()) {
        plan.issues.push({ sheet: sheetName, line, message: 'Informe o nome ou endereço do centro.' });
        continue;
      }
      const explicitType = rawType ? parseType(rawType) : undefined;
      if (rawType && !explicitType) {
        plan.issues.push({ sheet: sheetName, line, message: 'Tipo inválido. Use Receita/CR ou Despesa/DB.' });
        continue;
      }
      const types: TransactionType[] = explicitType ? [explicitType] : mode === 'BOTH' ? ['INCOME', 'EXPENSE'] : [mode];
      for (const type of types) {
        const name = financialCenterImportName(rawName, type);
        if (!name || name.length > 200) {
          plan.issues.push({ sheet: sheetName, line, message: 'O nome deve ter de 1 a 195 caracteres antes do sufixo.' });
          break;
        }
        const key = identity({ name, type });
        const status: CenterImportRow['status'] = seen.has(key) ? 'duplicate' : saved.has(key) ? 'existing' : 'new';
        seen.add(key);
        plan.rows.push({ sheet: sheetName, line, name, type, status });
        if (status === 'new') plan.newCount++;
        else if (status === 'existing') plan.existingCount++;
        else plan.duplicateCount++;
      }
    }
  }
  if (!plan.sourceRows && !plan.issues.length) throw new ValidationError('Nenhum centro encontrado na planilha. Informe os nomes abaixo de Nome ou Endereço.');
  return plan;
}
