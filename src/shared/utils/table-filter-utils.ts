/** Serializa filtros compostos para actions que reproduzem query strings. */
export function serializeTableFilters(filters: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(filters).map(([key, value]) => [
      key,
      value !== null && typeof value === 'object' ? JSON.stringify(value) : value,
    ]),
  );
}

function comparableDate(value: unknown): number | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)) return null;
  const timestamp = Date.parse(`${value.split('T')[0]}T00:00:00.000Z`);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function finiteNumber(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** Aplica no modo local os formatos emitidos pelo DynamicFilterModal. */
export function matchesTableFilter(itemValue: unknown, filterValue: unknown): boolean {
  if (filterValue === null || filterValue === undefined || filterValue === '') return true;

  if (Array.isArray(filterValue)) {
    return filterValue.some((value) => String(itemValue) === String(value));
  }

  if (typeof filterValue === 'object') {
    const range = filterValue as Record<string, unknown>;

    if ('from' in range || 'to' in range) {
      const itemDate = comparableDate(itemValue);
      const fromDate = comparableDate(range.from);
      const toDate = comparableDate(range.to);
      if (itemDate !== null && (fromDate !== null || toDate !== null)) {
        return (fromDate === null || itemDate >= fromDate) && (toDate === null || itemDate <= toDate);
      }
    }

    if ('min' in range || 'max' in range || 'from' in range || 'to' in range) {
      const itemNumber = finiteNumber(itemValue);
      const min = finiteNumber(range.min ?? range.from);
      const max = finiteNumber(range.max ?? range.to);
      if (itemNumber === null) return false;
      return (min === null || itemNumber >= min) && (max === null || itemNumber <= max);
    }

    return false;
  }

  const itemText = String(itemValue ?? '').toLowerCase();
  const filterText = String(filterValue).toLowerCase();
  if (itemText === filterText || itemText.includes(filterText)) return true;

  const itemNumber = finiteNumber(itemValue);
  const filterNumber = finiteNumber(filterValue);
  return itemNumber !== null && filterNumber !== null && itemNumber === filterNumber;
}
