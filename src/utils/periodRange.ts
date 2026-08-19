import { MONTH_LABELS_FULL } from '@/components/dashboard/MonthlyIncomeExpenseChart';

/**
 * "Período limpo" (Tarefa 6.3): sem filtro de data, pega todo o histórico
 * disponível. Fica 15 anos atrás em vez de uma data fixa antiga porque é
 * exatamente o teto de intervalo aceito pelo Dashboard e pelos Relatórios
 * (5480 dias, ver `shared/validators/dashboard.ts`) — com `2000-01-01` a
 * chamada estourava esse limite e voltava 400 em vez do histórico.
 */
export const CLEARED_PERIOD_START = (() => {
  const CLEARED_PERIOD_DAYS = 5470; // ~15 anos, com folga sob o teto de 5480.
  const start = new Date();
  start.setDate(start.getDate() - CLEARED_PERIOD_DAYS);
  return start.toISOString().split('T')[0];
})();

/**
 * Converte ano(s) + meses selecionados (1-12) no intervalo [primeiro dia do
 * menor mês do menor ano, último dia do maior mês do maior ano]. Com mais de
 * um ano selecionado (Tarefa 5.2), os mesmos meses se aplicam a cada ano — o
 * intervalo resultante é o span contínuo entre o mais antigo e o mais recente
 * (pode incluir meses "de fora" se os anos não forem consecutivos).
 */
export function getPeriodRange(years: number | number[], selectedMonths: number[]): { startDate: string; endDate: string } {
  const yearList = Array.isArray(years) ? years : [years];
  const minYear = Math.min(...yearList);
  const maxYear = Math.max(...yearList);
  const minMonth = Math.min(...selectedMonths);
  const maxMonth = Math.max(...selectedMonths);
  return {
    startDate: new Date(minYear, minMonth - 1, 1).toISOString().split('T')[0],
    endDate: new Date(maxYear, maxMonth, 0).toISOString().split('T')[0],
  };
}

/** Rótulo legível do período para subtítulos de gráfico (ex.: "Julho de 2026", "Ano inteiro de 2026", "Jan a Jul de 2026", "Todo o período"). */
export function formatPeriodLabel(startDate: string, endDate: string): string {
  if (startDate === CLEARED_PERIOD_START) return 'Todo o período';

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${MONTH_LABELS_FULL[start.getMonth()]} de ${start.getFullYear()}`;
  }
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === 0 && end.getMonth() === 11) {
    return `Ano inteiro de ${start.getFullYear()}`;
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${MONTH_LABELS_FULL[start.getMonth()]} a ${MONTH_LABELS_FULL[end.getMonth()]} de ${end.getFullYear()}`;
  }
  return `${MONTH_LABELS_FULL[start.getMonth()]} de ${start.getFullYear()} a ${MONTH_LABELS_FULL[end.getMonth()]} de ${end.getFullYear()}`;
}
