/**
 * Formatação da grid de Investimentos. Mantida separada dos componentes porque
 * a tabela, os modais e a exportação precisam exatamente das mesmas regras
 * (célula vazia = "sem valor", nunca "0,00").
 */

const MONTH_NAMES_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const MONTH_NAMES_FULL = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

/** "1.234,56" — sem símbolo, como a grid do layout. */
export function formatAmount(value: number): string {
  const abs = Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return value < 0 ? `-${abs}` : abs;
}

/** Célula da grid: zero/nulo aparece em branco, não como "0,00". */
export function formatCell(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return '';
  return formatAmount(value);
}

/** "R$ 1.234,56" — usado nas pills e nos modais. */
export function formatCurrencyBRL(value: number): string {
  return `R$ ${formatAmount(value)}`;
}

/** "35,26%" */
export function formatPercent(value: number): string {
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

/** "Ago 2024" — cabeçalho das colunas de mês. */
export function formatMonthHeader(month: number, year: number): string {
  return `${MONTH_NAMES_SHORT[month - 1]} ${year}`;
}

/** "Jan 2025" — título dos modais de mês. */
export const formatMonthShort = formatMonthHeader;

/** YYYY-MM-DD → DD/MM/YYYY. */
export function formatDateBR(value: string | null | undefined): string {
  if (!value) return '';
  const [year, month, day] = value.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

/** "2024-08" → { year, month } */
export function parseMonthValue(value: string): { year: number; month: number } {
  const [year, month] = value.split('-').map(Number);
  return { year, month };
}

/** { year, month } → "2024-08" (valor de um <input type="month">). */
export function toMonthValue(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function toISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Janela padrão da tela: os 6 meses terminando no mês corrente, em datas
 * completas — o filtro é o mesmo `CalendarPicker` de Planejamento e Controle.
 */
export function getDefaultDateRange(): { from: string; to: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  return { from: toISODate(start), to: toISODate(now) };
}

/** YYYY-MM-DD → YYYY-MM (a grid é mensal; o filtro é por dia). */
export function toMonthOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

