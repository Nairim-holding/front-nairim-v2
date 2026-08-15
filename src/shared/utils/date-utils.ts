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
