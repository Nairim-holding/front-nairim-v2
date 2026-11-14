import { normalizeReportText } from './lease-report-matching';

/** Identifica obrigações mensais para verificar duplicidade e sincronizar parcelas. */
export function leaseMonthlyTransactionKind(source: {
  description: string;
  category?: { type: string } | null;
  subcategory?: { name: string } | null;
}): 'rent' | 'commission' | 'condominium' | null {
  const text = normalizeReportText(source.description);
  if (source.category?.type === 'EXPENSE' && text.includes('comissao')) return 'commission';
  if (source.category?.type !== 'INCOME') return null;
  if (/^(?:restituicao )?condominio\b/.test(text)) return 'condominium';
  if (/\b(?:multa|condominio|iptu|irrf|comissao)\b/.test(text)) return null;
  if (/^(?:(?:entrada|recebimento|valor) a maior\b|complemento (?:de |do )?aluguel\b)/.test(text)) return null;
  return text.includes('aluguel') || normalizeReportText(source.subcategory?.name ?? '') === 'alugueis' ? 'rent' : null;
}
