'use client';

import { Fragment, forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import Link from 'next/link';
import { Plus, Minus, AlertTriangle } from 'lucide-react';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { buildReportActionParams } from '../_lib/buildReportQuery';
import { getDemonstrativoReportAction } from '@/server/actions/financial-report';
import type { ReportFiltersState, ReportGroupRow, ReportItemRow, ReportRegime, ReportViewHandle } from '../_lib/types';

const STATUS_LABEL: Record<string, string> = { PENDING: 'Pendente', COMPLETED: 'Concluído' };

/**
 * Linha compacta de lançamento dentro do DFC. Mantém a estrutura de 3 colunas
 * físicas da tabela (ícone/rótulo/valor) em vez de abrir 11 colunas como nos
 * demais relatórios — evita desalinhar as linhas de Linha/Grupo acima — mas
 * ainda expõe todos os campos do lançamento pedidos no features.md.
 */
function DfcItemRow({ item }: { item: ReportItemRow }) {
  const meta = [
    item.category?.name,
    item.subcategory?.name,
    item.financialInstitution?.name,
    item.card?.name,
    item.supplier?.name,
    item.center?.name,
    STATUS_LABEL[item.status] ?? item.status,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <tr className="text-xs text-content-secondary border-b border-ui-border-soft/40 hover:bg-surface-subtle">
      <td className="px-3 py-1.5"></td>
      <td className="px-3 py-1.5 pl-10">
        <div className="text-content-secondary">{item.description}</div>
        <div className="text-[11px] text-content-muted">
          Evento {formatDate(item.event_date)} · Efetiva {formatDate(item.effective_date)}
          {meta ? ` · ${meta}` : ''}
        </div>
      </td>
      <td className="px-3 py-1.5 text-right align-top">{formatCurrency(item.amount)}</td>
    </tr>
  );
}

type DfcGroupBy = 'day' | 'subcategory';
type DfcLineKind = 'line' | 'subtotal' | 'final';

interface DfcLine {
  key: string;
  label: string;
  kind: DfcLineKind;
  sign: 1 | -1;
  total: number;
  groups: ReportGroupRow[];
}

interface DfcResponse {
  groupBy: DfcGroupBy;
  lines: DfcLine[];
  unclassifiedExpenseTotal: number;
  unclassifiedExpenseCategories?: { id: string; name: string; total: number }[];
}

interface DemonstrativoViewProps {
  dateRange: { from: string; to: string };
  regime: ReportRegime;
  filters: ReportFiltersState;
}

function formatSigned(value: number, sign: 1 | -1): string {
  const abs = formatCurrency(Math.abs(value));
  return sign < 0 ? `- ${abs}` : abs;
}

const DemonstrativoView = forwardRef<ReportViewHandle, DemonstrativoViewProps>(function DemonstrativoView(
  { dateRange, regime, filters },
  ref
) {
  const tableRef = useRef<HTMLTableElement>(null);
  const [data, setData] = useState<DfcResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<DfcGroupBy>('day');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useImperativeHandle(ref, () => ({
    getTableElement: () => tableRef.current,
  }));

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const raw = buildReportActionParams({ from: dateRange.from, to: dateRange.to, regime, filters });
        raw.groupBy = groupBy;
        const result = await getDemonstrativoReportAction(raw);
        if (!result.ok) throw new Error(result.error);
        // A action serializa `event_date`/`effective_date: Date` para string no
        // round-trip servidor→cliente — mesmo shape que DfcResponse já espera.
        if (!cancelled) setData(result.data as unknown as DfcResponse);
      } catch (error) {
        console.error('[DemonstrativoView] Erro ao carregar demonstrativo:', error);
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dateRange.from, dateRange.to, regime, filters, groupBy]);

  const toggleLine = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-content-muted text-sm">
        Nenhum dado encontrado para o período selecionado.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-sm font-semibold text-content">Demonstrativo de Resultado Financeiro do Caixa</h2>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-content-muted">Agrupar por:</span>
          <div className="flex rounded-md border border-ui-border overflow-hidden">
            {(['day', 'subcategory'] as DfcGroupBy[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroupBy(g)}
                className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                  groupBy === g ? 'bg-brand text-content-inverse' : 'bg-surface text-content-secondary hover:bg-surface-subtle'
                }`}
              >
                {g === 'day' ? 'Dia' : 'Categoria'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {data.unclassifiedExpenseTotal > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-300/60 dark:border-amber-700/40 rounded-lg px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1.5 min-w-0">
            <span>
              {formatCurrency(data.unclassifiedExpenseTotal)} em despesas do período estão sem classificação DFC
              (Impostos / Despesa Variável / Despesa Fixa / Pessoal). Elas entram no resultado pela linha
              &ldquo;Outras Despesas (sem classificação DFC)&rdquo;.
            </span>

            {/* Nomear as categorias evita a caça uma a uma em Categorias: o
                aviso antes so dava o total, sem dizer onde mexer. */}
            {(data.unclassifiedExpenseCategories?.length ?? 0) > 0 && (
              <ul className="flex flex-wrap gap-x-3 gap-y-1">
                {data.unclassifiedExpenseCategories!.map((c) => (
                  <li key={c.id} className="font-medium">
                    {c.name}
                    <span className="font-normal opacity-80"> — {formatCurrency(c.total)}</span>
                  </li>
                ))}
              </ul>
            )}

            <span>
              Classifique{' '}
              <Link href="/dashboard/categorias" className="underline font-medium hover:opacity-80">
                em Financeiro → Categorias
              </Link>
              {' '}para que apareçam na linha correta.
            </span>
          </div>
        </div>
      )}

      <div className="bg-surface border border-ui-border-soft rounded-lg overflow-x-auto">
        <table ref={tableRef} className="w-full border-collapse">
          <tbody>
            {data.lines.map((line) => {
              const isExpandable = line.kind === 'line';
              const isOpen = expanded.has(line.key);
              const valueColor =
                line.kind === 'line'
                  ? line.sign < 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                  : line.sign < 0
                    ? 'text-red-700 dark:text-red-300'
                    : 'text-emerald-700 dark:text-emerald-300';
              const rowBg =
                line.kind === 'final'
                  ? line.sign < 0
                    ? 'bg-red-50 dark:bg-red-950/30'
                    : 'bg-emerald-50 dark:bg-emerald-950/30'
                  : line.kind === 'subtotal'
                    ? 'bg-surface-subtle'
                    : '';

              return (
                <Fragment key={line.key}>
                  <tr className={`border-b border-ui-border-soft/60 ${rowBg}`}>
                    <td className="px-3 py-2 w-8">
                      {isExpandable && line.groups.length > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleLine(line.key)}
                          className="p-0.5 rounded border border-ui-border text-content-muted hover:text-content hover:bg-surface-subtle transition-colors"
                          title={isOpen ? 'Recolher' : 'Expandir'}
                        >
                          {isOpen ? <Minus size={11} /> : <Plus size={11} />}
                        </button>
                      )}
                    </td>
                    <td className={`px-3 py-2 text-sm ${line.kind === 'line' ? 'text-content-secondary' : 'font-bold text-content'}`}>
                      {line.kind === 'final' ? '= ' : line.kind === 'subtotal' ? '→ ' : ''}
                      {line.label}
                    </td>
                    <td className={`px-3 py-2 text-sm text-right font-semibold ${valueColor}`}>
                      {formatSigned(line.total, line.sign)}
                    </td>
                  </tr>
                  {isOpen &&
                    line.groups.map((g) => {
                      const groupKey = `${line.key}:${g.key}`;
                      const isGroupOpen = expandedGroups.has(groupKey);
                      return (
                        <Fragment key={groupKey}>
                          <tr className="text-xs text-content-secondary border-b border-ui-border-soft/40">
                            <td className="px-3 py-1.5">
                              {g.items.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => toggleGroup(groupKey)}
                                  className="p-0.5 rounded border border-ui-border-soft text-content-muted hover:text-content hover:bg-surface-subtle transition-colors ml-2"
                                  title={isGroupOpen ? 'Recolher lançamentos' : 'Ver lançamentos'}
                                >
                                  {isGroupOpen ? <Minus size={9} /> : <Plus size={9} />}
                                </button>
                              )}
                            </td>
                            <td className="px-3 py-1.5 pl-6">{g.label}</td>
                            <td className="px-3 py-1.5 text-right">{formatCurrency(g.total)}</td>
                          </tr>
                          {isGroupOpen && g.items.map((item) => <DfcItemRow key={item.id} item={item} />)}
                        </Fragment>
                      );
                    })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default DemonstrativoView;
