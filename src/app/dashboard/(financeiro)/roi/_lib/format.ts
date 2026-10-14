/** Formatação dos indicadores do ROI — `null` significa "não dá para calcular". */

export const formatRate = (value: number | null): string =>
  value === null ? '—' : `${(value * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

export const formatDecimal = (value: number | null, digits = 1): string =>
  value === null ? '—' : value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const formatIsoDate = (iso: string | null): string => {
  if (!iso) return '—';
  const [year, month, day] = iso.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
};
