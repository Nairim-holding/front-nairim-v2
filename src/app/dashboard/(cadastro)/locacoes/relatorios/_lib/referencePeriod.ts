import type { Quarter, ReferenceMonth } from '@/core/entities/lease-report';

/**
 * Rótulos e chaves dos meses/trimestres de referência do Relatório de
 * Locações. Só formatação — a aritmética de período mora em
 * `core/entities/lease-report.ts`.
 */

export const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const MONTH_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const monthKey = ({ year, month }: ReferenceMonth): string => `${year}-${String(month).padStart(2, '0')}`;

export const parseMonthKey = (key: string): ReferenceMonth => {
  const [year, month] = key.split('-');
  return { year: Number(year), month: Number(month) };
};

/** "Dezembro de 2025". */
export const monthLabel = ({ year, month }: ReferenceMonth): string => `${MONTH_NAMES[month - 1]} de ${year}`;

/** "Dez/2025" — usado onde o espaço é curto (cabeçalhos de quadro). */
export const monthShortLabel = ({ year, month }: ReferenceMonth): string => `${MONTH_ABBR[month - 1]}/${year}`;

/** "4º Trim/2025". */
export const quarterLabel = ({ year, quarter }: Quarter): string => `${quarter}º Trim/${year}`;

export const sortMonths = (months: ReferenceMonth[]): ReferenceMonth[] =>
  [...months].sort((a, b) => a.year - b.year || a.month - b.month);

/**
 * Rótulo do período para o cabeçalho de impressão. Meses consecutivos viram
 * intervalo ("Outubro de 2025 a Dezembro de 2025"); seleções salteadas são
 * listadas ("Out/2025, Dez/2025").
 */
export function describeSelectedMonths(months: ReferenceMonth[]): string {
  const sorted = sortMonths(months);
  if (sorted.length === 0) return 'Nenhum mês selecionado';
  if (sorted.length === 1) return `Mês de referência: ${monthLabel(sorted[0])}`;

  const isContiguous = sorted.every((m, i) => {
    if (i === 0) return true;
    const previous = sorted[i - 1];
    const expected = previous.month === 12 ? { year: previous.year + 1, month: 1 } : { year: previous.year, month: previous.month + 1 };
    return m.year === expected.year && m.month === expected.month;
  });

  if (isContiguous) return `Meses de referência: ${monthLabel(sorted[0])} a ${monthLabel(sorted[sorted.length - 1])}`;
  return `Meses de referência: ${sorted.map(monthShortLabel).join(', ')}`;
}

/** Intervalo de datas equivalente à seleção — o cabeçalho de impressão exige um. */
export function selectionDateRange(months: ReferenceMonth[]): { from: string; to: string } {
  const sorted = sortMonths(months);
  if (sorted.length === 0) {
    const today = new Date().toISOString().slice(0, 10);
    return { from: today, to: today };
  }
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const lastDay = new Date(Date.UTC(last.year, last.month, 0)).getUTCDate();
  return {
    from: `${first.year}-${String(first.month).padStart(2, '0')}-01`,
    to: `${last.year}-${String(last.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
}

/** Nome de arquivo da exportação: locacoes_2025-10_a_2025-12. */
export function exportFilename(months: ReferenceMonth[]): string {
  const sorted = sortMonths(months);
  if (sorted.length === 0) return 'relatorio_locacoes';
  if (sorted.length === 1) return `relatorio_locacoes_${monthKey(sorted[0])}`;
  return `relatorio_locacoes_${monthKey(sorted[0])}_a_${monthKey(sorted[sorted.length - 1])}`;
}
