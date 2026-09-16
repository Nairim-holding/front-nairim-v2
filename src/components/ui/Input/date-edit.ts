import { isValidIsoDateString } from '@/shared/utils/date-utils';

export function dateDisplay(value: string): string {
  return /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)
    ? value.slice(0, 10).split('-').reverse().join('/') : value;
}

export function dateValue(draft: string): string {
  const match = draft.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : draft;
}

// Keep existing separators when editing a segment: deleting a day must not
// pull digits from the month or year into it.
export function editDate(raw: string, caret: number): { text: string; caret: number } {
  const before = raw.slice(0, caret).replace(/[^\d/]/g, '');
  let text = raw.replace(/[^\d/]/g, '');
  let position = before.length;
  if (!text.includes('/')) {
    const digits = text.slice(0, 8);
    text = digits.length > 4 ? `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
      : digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
    position += (position > 2 ? 1 : 0) + (position > 4 ? 1 : 0);
  } else if (/^\d{2}\/\d{3}$/.test(text)) {
    text = `${text.slice(0, 5)}/${text.slice(5)}`;
    if (position > 5) position += 1;
  }
  return { text: text.slice(0, 10), caret: Math.min(position, 10) };
}

export function creditDateError(value: string): string {
  if (!isValidIsoDateString(value)) return 'Informe uma data válida.';
  const year = Number(value.slice(0, 4));
  if (year < 2000) return 'O ano deve ser maior ou igual a 2000.';
  if (year > 2200) return 'O ano deve ser menor ou igual a 2200.';
  return '';
}
