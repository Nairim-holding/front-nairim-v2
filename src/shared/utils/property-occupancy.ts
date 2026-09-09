/** Contratos DATE-only continuam válidos durante todo o último dia em São Paulo. */
export function occupancyDate(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00.000Z`);
}

interface OccupancyLease {
  status: string;
  end_date: string | Date;
  deleted_at?: string | Date | null;
}

/** Usa a mesma regra da disponibilidade, incluindo contratos futuros. */
export function findOccupyingLease<T extends OccupancyLease>(
  leases: readonly T[] | null | undefined,
  now = new Date(),
): T | undefined {
  const today = occupancyDate(now).getTime();
  return leases?.find(lease =>
    !lease.deleted_at && lease.status !== 'CANCELED' &&
    new Date(lease.end_date).getTime() >= today,
  );
}
