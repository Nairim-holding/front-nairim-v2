import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { financialCenterImportName, parseFinancialCenterWorkbook } from './financial-center-import-parser';

function workbook(sheets: Record<string, unknown[][]>, bookType: XLSX.BookType = 'xlsx') {
  const book = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), name);
  return new Uint8Array(XLSX.write(book, { type: 'buffer', bookType }));
}

describe('leitura da planilha de centros', () => {
  it('lê títulos e endereços em várias abas no formato da Iholding, incluindo linhas sem número', () => {
    const bytes = workbook({ Dominio: [['Imoveis Nome DOMINIO'], [], ['Locação Garça'], ['', 'ENDEREÇO'], [1, ' Rua América,  100 '], ['', 'Rua América, 100 Confissão']], Wagner: [['Imóveis WAGNER'], ['', 'ENDEREÇO'], [1, 'General Glicério 25 A']] });
    const result = parseFinancialCenterWorkbook(bytes, 'BOTH');
    expect(result.issues).toEqual([]);
    expect(result.sourceRows).toBe(3);
    expect(result.newCount).toBe(6);
    expect(result.rows[0]).toEqual({ sheet: 'Dominio', line: 5, name: 'Rua América, 100 (CR)', type: 'INCOME', status: 'new' });
    expect(result.rows[1].name).toBe('Rua América, 100 (DB)');
    expect(result.rows[2].name).toBe('Rua América, 100 Confissão (CR)');
  });

  it('importa apenas abas selecionadas e não interpreta títulos de abas como empresas', () => {
    const bytes = workbook({ EmpresaA: [['Nome'], ['Centro A']], EmpresaB: [['Nome'], ['Centro B']] });
    const result = parseFinancialCenterWorkbook(bytes, 'INCOME', [], ['EmpresaB']);
    expect(result.sheets).toEqual(['EmpresaA', 'EmpresaB']);
    expect(result.selectedSheets).toEqual(['EmpresaB']);
    expect(result.rows.map(row => row.name)).toEqual(['Centro B (CR)']);
    expect(() => parseFinancialCenterWorkbook(bytes, 'BOTH', [], [])).toThrow(/aba válida/);
    expect(() => parseFinancialCenterWorkbook(bytes, 'BOTH', [], ['Inexistente'])).toThrow(/aba válida/);
  });

  it('ignora duplicatas no arquivo e centros existentes com e sem sufixo', () => {
    const result = parseFinancialCenterWorkbook(workbook({ Centro: [['Nome'], ['Rua América'], [' rua america (CR) '], ['Rua B']] }), 'BOTH', [{ name: 'Rua América', type: 'INCOME' }, { name: 'Rua América (DB)', type: 'EXPENSE' }]);
    expect(result.existingCount).toBe(2);
    expect(result.duplicateCount).toBe(2);
    expect(result.newCount).toBe(2);
    expect(result.rows.at(-1)?.name).toBe('Rua B (DB)');
  });

  it('respeita o tipo explícito e usa a opção escolhida apenas para tipo vazio', () => {
    const result = parseFinancialCenterWorkbook(workbook({ Centros: [['Nome', 'Tipo'], ['A', 'Receita'], ['B (CR)', 'DB'], ['C', ''], ['D', 'Crédito'], ['E', 'EXPENSE']] }), 'EXPENSE');
    expect(result.rows.map(row => [row.name, row.type])).toEqual([['A (CR)', 'INCOME'], ['B (DB)', 'EXPENSE'], ['C (DB)', 'EXPENSE'], ['D (CR)', 'INCOME'], ['E (DB)', 'EXPENSE']]);
    expect(result.issues).toEqual([]);
  });

  it('reporta nomes ausentes, tipos inválidos e nomes extensos por aba e linha', () => {
    const result = parseFinancialCenterWorkbook(workbook({ Centros: [['NOME', 'TIPO'], ['', 'CR'], ['A', 'Outro'], ['X'.repeat(196), 'DB']] }), 'BOTH');
    expect(result.issues.map(issue => issue.line)).toEqual([2, 3, 4]);
    expect(result.newCount).toBe(0);
  });

  it('rejeita fórmulas de nome mesmo quando possuem valor em cache', () => {
    const book = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([['Nome'], ['Rua A']]);
    sheet.A2 = { t: 's', f: '"Rua A"', v: 'Rua A' };
    XLSX.utils.book_append_sheet(book, sheet, 'Centros');
    const result = parseFinancialCenterWorkbook(new Uint8Array(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' })), 'BOTH');
    expect(result.newCount).toBe(0);
    expect(result.issues[0].message).toMatch(/sem fórmulas/);
  });

  it('aceita Excel .xls e não aceita texto ou arquivo sem dados', () => {
    expect(parseFinancialCenterWorkbook(workbook({ Centros: [['Nome'], ['Centro A']] }, 'biff8'), 'INCOME').newCount).toBe(1);
    expect(() => parseFinancialCenterWorkbook(new TextEncoder().encode('Nome\nRua A'), 'BOTH')).toThrow(/Excel válido/);
    expect(() => parseFinancialCenterWorkbook(workbook({ Centros: [['Nome']] }), 'BOTH')).toThrow(/Nenhum centro/);
  });

  it('não trata títulos de aba sem cabeçalho como nomes de centros', () => {
    const result = parseFinancialCenterWorkbook(workbook({ Centros: [['Imóveis da empresa'], ['Rua A']] }), 'BOTH');
    expect(result.newCount).toBe(0);
    expect(result.issues[0].message).toMatch(/Cabeçalho/);
  });

  it('limita a quantidade de linhas mesmo quando os centros são repetidos', () => {
    const bytes = workbook({ Centros: [['Nome'], ...Array.from({ length: 5001 }, () => ['Centro A'])] });
    expect(() => parseFinancialCenterWorkbook(bytes, 'BOTH')).toThrow(/5.000 linhas/);
  });

  it('corrige sufixos sem repeti-los e preserva acentuação do nome', () => {
    expect(financialCenterImportName('  Prédio  São João (CR) (DB) ', 'INCOME')).toBe('Prédio São João (CR)');
    expect(financialCenterImportName('(DB)', 'EXPENSE')).toBe('');
  });
});
