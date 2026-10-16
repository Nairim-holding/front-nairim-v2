import { normalizeReportText } from './lease-report-matching';

/** Monthly obligations must never offset an amount of the opposite type. */
export function leaseMonthlyTransactionKind(source: {
  description: string;
  category?: { type: string } | null;
  subcategory?: { name: string } | null;
}): 'rent' | 'commission' | null {
  const text = normalizeReportText(source.description);
  if (source.category?.type === 'EXPENSE' && text.includes('comissao')) return 'commission';
  if (source.category?.type !== 'INCOME') return null;
  if (/\b(?:multa|condominio|iptu|irrf|comissao)\b/.test(text)) return null;
  return text.includes('aluguel') || normalizeReportText(source.subcategory?.name ?? '') === 'alugueis' ? 'rent' : null;
}
