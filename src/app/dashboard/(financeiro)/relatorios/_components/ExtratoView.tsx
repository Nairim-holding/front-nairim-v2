'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ChevronUp, ChevronDown, Search } from 'lucide-react';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { buildReportActionParams } from '../_lib/buildReportQuery';
import { getExtratoReportAction } from '@/server/actions/financial-report';
import type { ExtratoResponse, ReportFiltersState, ReportRegime, ReportViewHandle } from '../_lib/types';

interface ExtratoViewProps {
  dateRange: { from: string; to: string };
  regime: ReportRegime;
  filters: ReportFiltersState;
}

type SortField = 'date' | 'description' | 'contact' | 'category' | 'subcategory' | 'center' | 'credit' | 'debit' | 'balance';
type SortDir = 'asc' | 'desc';

const ExtratoView = forwardRef<ReportViewHandle, ExtratoViewProps>(function ExtratoView(
  { dateRange, regime, filters },
  ref
) {
  const tableRef = useRef<HTMLTableElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<ExtratoResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useImperativeHandle(ref, () => ({
    getTableElement: () => tableRef.current,
    getSummaryElement: () => summaryRef.current,
  }));

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const raw = buildReportActionParams({ from: dateRange.from, to: dateRange.to, regime, filters });
        const result = await getExtratoReportAction(raw);
        if (!result.ok) throw new Error(result.error);
        // A action serializa `event_date`/`effective_date: Date` para string no
        // round-trip servidor→cliente — mesmo shape que ExtratoResponse já espera.
        if (!cancelled) setData(result.data as unknown as ExtratoResponse);
      } catch (error) {
        console.error('[ExtratoView] Erro ao carregar extrato:', error);
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dateRange.from, dateRange.to, regime, filters]);

  const filteredItems = useMemo(() => {
    const items = data?.items ?? [];
    if (!search.trim()) return items;
    const term = search.trim().toLowerCase();
    return items.filter(
      (i) => i.description.toLowerCase().includes(term) || (i.supplier?.name ?? '').toLowerCase().includes(term)
    );
  }, [data, search]);

  const sortedItems = useMemo(() => {
    if (!sortField) return filteredItems;
    const copy = [...filteredItems];
    const value = (item: (typeof copy)[number]): string | number => {
      switch (sortField) {
        case 'date': return item.effective_date;
        case 'description': return item.description;
        case 'contact': return item.supplier?.name ?? '';
        case 'category': return item.category?.name ?? '';
        case 'subcategory': return item.subcategory?.name ?? '';
        case 'center': return item.center?.name ?? '';
        case 'credit': return item.credit;
        case 'debit': return item.debit;
        case 'balance': return item.balance;
      }
    };
    copy.sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      const diff = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? diff : -diff;
    });
    return copy;
  }, [filteredItems, sortField, sortDir]);

  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return field;
      }
      setSortDir('asc');
      return field;
    });
  }, []);

  const SortIcon = ({ field }: { field: SortField }) =>
    sortField === field ? (
      sortDir === 'asc' ? <ChevronUp size={12} className="inline ml-1" /> : <ChevronDown size={12} className="inline ml-1" />
    ) : null;

  // Ordem de colunas padronizada com Lançamentos Financeiros (Tarefa 4.3-F),
  // restrita às colunas que o Extrato de fato usa: Data (efetiva) > Categoria
  // > Subcategoria > Contato > Descrição > Centro > Crédito/Débito/Saldo (o
  // Extrato não tem Instituição/Cartão/Status — não se aplicam a este relatório).
  const columns: { field: SortField; label: string; align?: 'right' }[] = [
    { field: 'date', label: 'Data' },
    { field: 'category', label: 'Categoria' },
    { field: 'subcategory', label: 'Subcategoria' },
    { field: 'contact', label: 'Contato' },
    { field: 'description', label: 'Descrição' },
    { field: 'center', label: 'Centro' },
    { field: 'credit', label: 'Crédito', align: 'right' },
    { field: 'debit', label: 'Débito', align: 'right' },
    { field: 'balance', label: 'Saldo', align: 'right' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
      </div>
    );
  }

  const summary = data?.summary;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-content">Extrato</h2>
        {summary && (
          <span className="text-xs text-content-muted">
            Saldo Anterior: <strong className="text-content">{formatCurrency(summary.saldoAnterior)}</strong>
          </span>
        )}
      </div>

      <div className="relative w-full max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar..."
          className="w-full pl-8 pr-3 py-1.5 text-sm border border-ui-border rounded-lg bg-surface text-content focus:outline-none focus:border-brand"
        />
      </div>

      <div className="bg-surface border border-ui-border-soft rounded-lg overflow-x-auto">
        <table ref={tableRef} className="w-full border-collapse">
          <thead>
            <tr className="text-left text-[11px] font-semibold text-content-muted uppercase tracking-wide border-b border-ui-border-soft">
              {columns.map((c) => (
                <th
                  key={c.field}
                  onClick={() => handleSort(c.field)}
                  className={`px-3 py-2 cursor-pointer select-none whitespace-nowrap ${c.align === 'right' ? 'text-right' : ''}`}
                >
                  {c.label}
                  <SortIcon field={c.field} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summary && (
              <tr className="text-sm font-semibold bg-surface-subtle border-b border-ui-border-soft">
                <td className="px-3 py-2 text-content" colSpan={8}>
                  Saldo Anterior
                </td>
                <td className={`px-3 py-2 text-right font-bold ${summary.saldoAnterior < 0 ? 'text-red-600 dark:text-red-400' : 'text-content'}`}>
                  {formatCurrency(summary.saldoAnterior)}
                </td>
              </tr>
            )}
            {sortedItems.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-content-muted text-sm">
                  Nenhum lançamento encontrado.
                </td>
              </tr>
            )}
            {sortedItems.map((item) => (
              <tr key={item.id} className="text-sm text-content-secondary border-b border-ui-border-soft/60 hover:bg-surface-subtle">
                <td className="px-3 py-1.5 whitespace-nowrap">{formatDate(item.effective_date)}</td>
                <td className="px-3 py-1.5">{item.category?.name ?? '-'}</td>
                <td className="px-3 py-1.5">{item.subcategory?.name ?? '-'}</td>
                <td className="px-3 py-1.5">{item.supplier?.name ?? '-'}</td>
                <td className="px-3 py-1.5">{item.description}</td>
                <td className="px-3 py-1.5">{item.center?.name ?? '-'}</td>
                <td className="px-3 py-1.5 text-right text-emerald-600 dark:text-emerald-400">
                  {item.credit > 0 ? formatCurrency(item.credit) : ''}
                </td>
                {/* Débito = Despesa: laranja, mesma paleta de IncomeExpenseView (Tarefa 4.5 do guia de correções) — antes vermelho, cor reservada aqui para saldo negativo. */}
                <td className="px-3 py-1.5 text-right text-orange-600 dark:text-orange-400">
                  {item.debit > 0 ? formatCurrency(item.debit) : ''}
                </td>
                <td className={`px-3 py-1.5 text-right font-medium ${item.balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-content'}`}>
                  {formatCurrency(item.balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {summary && (
        <div ref={summaryRef} className="bg-surface border border-ui-border-soft rounded-lg p-4 max-w-md ml-auto w-full text-sm space-y-1.5">
          <div className="flex justify-between">
            <span className="text-content-secondary">Saldo Anterior</span>
            <span className="font-medium text-content">{formatCurrency(summary.saldoAnterior)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-content-secondary">Total de Receitas no Período</span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(summary.totalReceitas)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-content-secondary">Total de Despesas no Período</span>
            <span className="font-medium text-orange-600 dark:text-orange-400">{formatCurrency(summary.totalDespesas)}</span>
          </div>
          <div className="flex justify-between border-t border-ui-border-soft pt-1.5">
            <span className="text-content-secondary">Balanço no Período</span>
            <span className={`font-semibold ${summary.balancoPeriodo < 0 ? 'text-red-600 dark:text-red-400' : 'text-content'}`}>
              {formatCurrency(summary.balancoPeriodo)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-content-secondary font-semibold">Saldo Final</span>
            <span className={`font-bold ${summary.saldoFinal < 0 ? 'text-red-600 dark:text-red-400' : 'text-content'}`}>
              {formatCurrency(summary.saldoFinal)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
});

export default ExtratoView;
