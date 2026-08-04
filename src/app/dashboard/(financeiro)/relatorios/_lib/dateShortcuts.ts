const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function formatDateISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

export interface DateShortcut {
  label: string;
  from: string;
  to: string;
}

/** Atalhos exibidos na barra superior: Hoje, Últimos 7/30 dias e os dois últimos meses (mês atual e anterior). */
export function buildDateShortcuts(reference: Date = new Date()): DateShortcut[] {
  const today = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());

  const daysAgo = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return d;
  };

  const monthRange = (monthOffset: number) => {
    const first = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    const last = new Date(today.getFullYear(), today.getMonth() + monthOffset + 1, 0);
    return { from: formatDateISO(first), to: formatDateISO(last), label: MONTH_NAMES[first.getMonth()] };
  };

  const currentMonth = monthRange(0);
  const previousMonth = monthRange(-1);

  return [
    { label: 'Hoje', from: formatDateISO(today), to: formatDateISO(today) },
    { label: 'Últimos 7 dias', from: formatDateISO(daysAgo(6)), to: formatDateISO(today) },
    { label: 'Últimos 30 dias', from: formatDateISO(daysAgo(29)), to: formatDateISO(today) },
    { label: previousMonth.label, from: previousMonth.from, to: previousMonth.to },
    { label: currentMonth.label, from: currentMonth.from, to: currentMonth.to },
  ];
}

export function getDefaultReportDateRange(): { from: string; to: string } {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  return { from: formatDateISO(first), to: formatDateISO(today) };
}
