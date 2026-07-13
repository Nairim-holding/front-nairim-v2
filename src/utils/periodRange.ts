import { MONTH_LABELS_FULL } from '@/components/dashboard/MonthlyIncomeExpenseChart';

/** Converte ano + meses selecionados (1-12) no intervalo [primeiro dia do menor mês, último dia do maior mês]. */
export function getPeriodRange(year: number, selectedMonths: number[]): { startDate: string; endDate: string } {
  const minMonth = Math.min(...selectedMonths);
  const maxMonth = Math.max(...selectedMonths);
  return {
    startDate: new Date(year, minMonth - 1, 1).toISOString().split('T')[0],
    endDate: new Date(year, maxMonth, 0).toISOString().split('T')[0],
  };
}

/** Rótulo legível do período para subtítulos de gráfico (ex.: "Julho de 2026", "Ano inteiro de 2026", "Jan a Jul de 2026"). */
export function formatPeriodLabel(startDate: string, endDate: string): string {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${MONTH_LABELS_FULL[start.getMonth()]} de ${start.getFullYear()}`;
  }
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === 0 && end.getMonth() === 11) {
    return `Ano inteiro de ${start.getFullYear()}`;
  }
  return `${MONTH_LABELS_FULL[start.getMonth()]} a ${MONTH_LABELS_FULL[end.getMonth()]} de ${end.getFullYear()}`;
}
