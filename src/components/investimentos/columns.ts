import type { ColumnDef } from '@/types/types';

export const INVESTMENT_COLUMNS: (ColumnDef & { pixelWidth: number })[] = [
  { field: 'institution_label', label: 'Instituição', pixelWidth: 170 },
  { field: 'issuer', label: 'Emissor', pixelWidth: 130 },
  { field: 'product', label: 'Produto', pixelWidth: 180 },
  { field: 'maturity_date', label: 'Vencimento', pixelWidth: 110 },
  { field: 'notes', label: 'Observações', pixelWidth: 110 },
];

export function resolveInvestmentColumns(order: string[], visible?: string[]) {
  const fields = [...new Set([...order, ...INVESTMENT_COLUMNS.map(c => c.field)])];
  return fields.flatMap(field => {
    const column = INVESTMENT_COLUMNS.find(c => c.field === field);
    return column && (visible === undefined || visible.includes(field)) ? [column] : [];
  });
}
