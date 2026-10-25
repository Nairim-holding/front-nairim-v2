type StatementRow = { statement_order?: number | null; created_at?: Date | string; id: string };

/** Desempate de datas: legado sem sequência, baixas registradas e identidade. */
export function compareStatementOrder(a: StatementRow, b: StatementRow, direction: 'asc' | 'desc' = 'asc'): number {
  const aOrder = a.statement_order ?? null, bOrder = b.statement_order ?? null;
  const sequence = aOrder === bOrder ? 0 : aOrder === null ? -1 : bOrder === null ? 1 : aOrder - bOrder;
  const created = sequence || new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime();
  const result = created || a.id.localeCompare(b.id);
  return direction === 'asc' ? result : -result;
}
