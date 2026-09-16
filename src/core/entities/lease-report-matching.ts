/** Identificação conservadora dos lançamentos antigos sem lease_id. */
export const normalizeReportText = (value: string): string => value
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9/]+/g, ' ').trim();

export interface ReportLeaseMatch {
  id: string;
  contract_number: string;
  start_date: Date;
  end_date: Date;
  canceled_at: Date | null;
  property: { title: string };
}

export function matchReportLease<T extends ReportLeaseMatch>(
  description: string, date: Date, leases: T[],
): T | undefined {
  const text = normalizeReportText(description);
  const contract = text.match(/\bcontrato\s+([a-z0-9]+(?:\/[a-z0-9]+)*)\b/)?.[1];
  if (contract) {
    const matches = leases.filter((lease) => normalizeReportText(lease.contract_number) === contract);
    return matches.length === 1 ? matches[0] : undefined;
  }
  const matches = leases.filter((lease) => {
    const title = normalizeReportText(lease.property.title);
    return title.length >= 5 && ` ${text} `.includes(` ${title} `)
      && lease.start_date <= date && lease.end_date >= date
      && (!lease.canceled_at || lease.canceled_at >= date);
  });
  return matches.length === 1 ? matches[0] : undefined;
}
