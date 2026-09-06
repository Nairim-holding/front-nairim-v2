/**
 * Utilitários de data sem problemas de timezone, para campos DATE-only
 * (sem hora) do banco. Porte exato de api-nairim-v2/src/utils/date-utils.ts.
 *
 * Camada: shared.
 */

/**
 * Converte string/Date para um `Date` na meia-noite UTC — assim o dia gravado
 * no Prisma (`@db.Date`) é exato, independente do fuso do servidor.
 */
export function parseLocalDate(dateString: string | Date): Date {
  if (dateString instanceof Date) {
    return new Date(Date.UTC(dateString.getUTCFullYear(), dateString.getUTCMonth(), dateString.getUTCDate()));
  }
  if (!dateString) return new Date();

  if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateString)) {
    const parts = dateString.split('T')[0].split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(Date.UTC(year, month, day));
  }

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return new Date();
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

/** Formata para YYYY-MM-DD lendo os componentes em UTC. */
export function formatLocalDate(date: Date | string): string {
  const d = date instanceof Date ? date : parseLocalDate(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Formata para exibição brasileira DD/MM/YYYY. */
export function displayDate(date: Date | string | null): string {
  if (!date) return '';
  const d = date instanceof Date ? date : parseLocalDate(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${day}/${month}/${year}`;
}

/** Cria uma data no dia especificado, sem deslocamento de timezone (salva em UTC). */
export function createDateLocal(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

/** Valida formato e calendário real (por exemplo, rejeita 2026-02-31). */
export function isValidIsoDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

type DateRangeValue = { from?: unknown; to?: unknown };

function validDatePart(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)) return null;
  const datePart = value.split('T')[0];
  return isValidIsoDateString(datePart) ? datePart : null;
}

/** Condição Prisma para colunas SQL `DATE`. */
export function buildDateOnlyCondition(value: unknown): Record<string, Date> {
  if (value && typeof value === 'object') {
    const range = value as DateRangeValue;
    const from = validDatePart(range.from);
    const to = validDatePart(range.to);
    return {
      ...(from ? { gte: parseLocalDate(from) } : {}),
      ...(to ? { lte: parseLocalDate(to) } : {}),
    };
  }

  const date = validDatePart(value);
  return date ? { equals: parseLocalDate(date) } : {};
}

/** Condição Prisma para `DateTime`, cobrindo integralmente os dias escolhidos. */
export function buildDateTimeCondition(value: unknown): Record<string, Date> {
  if (value && typeof value === 'object') {
    const range = value as DateRangeValue;
    const from = validDatePart(range.from);
    const to = validDatePart(range.to);
    const condition: Record<string, Date> = {};
    if (from) condition.gte = parseLocalDate(from);
    if (to) {
      const end = parseLocalDate(to);
      end.setUTCHours(23, 59, 59, 999);
      condition.lte = end;
    }
    return condition;
  }

  const date = validDatePart(value);
  if (!date) return {};
  const start = parseLocalDate(date);
  const end = parseLocalDate(date);
  end.setUTCHours(23, 59, 59, 999);
  return { gte: start, lte: end };
}
