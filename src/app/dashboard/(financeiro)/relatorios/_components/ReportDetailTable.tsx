import { ChevronUp, ChevronDown } from 'lucide-react';
import { formatCurrency, formatDate } from '@/utils/formatters';
import type { ReportItemRow } from '../_lib/types';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  COMPLETED: 'Concluído',
};

export type DetailSortField =
  | 'description'
  | 'event_date'
  | 'effective_date'
  | 'category'
  | 'subcategory'
  | 'institution'
  | 'card'
  | 'contact'
  | 'center'
  | 'status'
  | 'amount';

export type DetailSortDir = 'asc' | 'desc';

const DETAIL_COLUMNS: { field: DetailSortField; label: string; align?: 'right' }[] = [
  { field: 'description', label: 'Descrição' },
  { field: 'event_date', label: 'Data Evento' },
  { field: 'effective_date', label: 'Data Efetiva' },
  { field: 'category', label: 'Categoria' },
  { field: 'subcategory', label: 'Subcategoria' },
  { field: 'institution', label: 'Instituição' },
  { field: 'card', label: 'Cartão' },
  { field: 'contact', label: 'Contato' },
  { field: 'center', label: 'Centro' },
  { field: 'status', label: 'Status' },
  { field: 'amount', label: 'Valor', align: 'right' },
];

function detailValueOf(item: ReportItemRow, field: DetailSortField): string | number {
  switch (field) {
    case 'description': return item.description;
    case 'event_date': return item.event_date;
    case 'effective_date': return item.effective_date;
    case 'category': return item.category?.name ?? '';
    case 'subcategory': return item.subcategory?.name ?? '';
    case 'institution': return item.financialInstitution?.name ?? '';
    case 'card': return item.card?.name ?? '';
    case 'contact': return item.supplier?.name ?? '';
    case 'center': return item.center?.name ?? '';
    case 'status': return item.status;
    case 'amount': return item.amount;
  }
}

/** Ordena uma lista de itens de detalhe por uma coluna — usado dentro de cada grupo (não achata o agrupamento). */
export function sortDetailItems<T extends ReportItemRow>(
  items: T[],
  field: DetailSortField | null,
  dir: DetailSortDir
): T[] {
  if (!field) return items;
  const copy = [...items];
  copy.sort((a, b) => {
    const av = detailValueOf(a, field);
    const bv = detailValueOf(b, field);
    const diff = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return dir === 'asc' ? diff : -diff;
  });
  return copy;
}

interface ReportDetailHeaderRowProps {
  sortField?: DetailSortField | null;
  sortDir?: DetailSortDir;
  onSort?: (field: DetailSortField) => void;
}

export function ReportDetailHeaderRow({ sortField = null, sortDir = 'asc', onSort }: ReportDetailHeaderRowProps = {}) {
  return (
    <tr className="text-left text-[11px] font-semibold text-content-muted uppercase tracking-wide border-b border-ui-border-soft">
      {DETAIL_COLUMNS.map((c) => (
        <th
          key={c.field}
          onClick={onSort ? () => onSort(c.field) : undefined}
          className={`px-3 py-2 whitespace-nowrap ${c.align === 'right' ? 'text-right' : ''} ${onSort ? 'cursor-pointer select-none' : ''}`}
        >
          {c.label}
          {onSort && sortField === c.field && (
            sortDir === 'asc' ? <ChevronUp size={12} className="inline ml-1" /> : <ChevronDown size={12} className="inline ml-1" />
          )}
        </th>
      ))}
    </tr>
  );
}

export function ReportDetailRows({ items }: { items: ReportItemRow[] }) {
  return (
    <>
      {items.map((item) => (
        <tr key={item.id} className="text-sm text-content-secondary border-b border-ui-border-soft/60 hover:bg-surface-subtle">
          <td className="px-3 py-1.5">{item.description}</td>
          <td className="px-3 py-1.5">{formatDate(item.event_date)}</td>
          <td className="px-3 py-1.5">{formatDate(item.effective_date)}</td>
          <td className="px-3 py-1.5">{item.category?.name ?? '-'}</td>
          <td className="px-3 py-1.5">{item.subcategory?.name ?? '-'}</td>
          <td className="px-3 py-1.5">{item.financialInstitution?.name ?? '-'}</td>
          <td className="px-3 py-1.5">{item.card?.name ?? '-'}</td>
          <td className="px-3 py-1.5">{item.supplier?.name ?? '-'}</td>
          <td className="px-3 py-1.5">{item.center?.name ?? '-'}</td>
          <td className="px-3 py-1.5">{STATUS_LABEL[item.status] ?? item.status}</td>
          <td className="px-3 py-1.5 text-right font-medium text-content">{formatCurrency(item.amount)}</td>
        </tr>
      ))}
    </>
  );
}
