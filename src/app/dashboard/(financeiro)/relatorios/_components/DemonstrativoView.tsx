'use client';

import { Fragment, forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import Link from 'next/link';
import { Plus, Minus, AlertTriangle } from 'lucide-react';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { buildReportActionParams } from '../_lib/buildReportQuery';
import { getDemonstrativoReportAction } from '@/server/actions/financial-report';
import type { ReportKind, ReportFiltersState, ReportGroupRow, ReportItemRow, ReportRegime, ReportViewHandle } from '../_lib/types';

const STATUS_LABEL: Record<string, string> = { PENDING: 'Pendente', COMPLETED: 'Concluído' };

const ITEM_COLUMNS = ['Competência', 'Data efetiva', 'Descrição', 'Valor', 'Tipo', 'Categoria', 'Subcategoria', 'Conta', 'Cartão', 'Contato', 'Centro', 'Status'];
/** Colunas físicas da tabela: 1 (expandir) + as 12 colunas dos demais blocos do Resumo. */
const TABLE_COLUMNS = 1 + ITEM_COLUMNS.length;

const dash = (value?: string | null) => value || '-';

function formatPct(value: number): string {
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

/** Cabeçalho das colunas dos lançamentos, exibido ao abrir um grupo. */
function DfcItemHeader() {
  return (
    <tr className="text-[10px] uppercase tracking-wide text-content-muted bg-surface-subtle border-b border-ui-border-soft/60">
      <th className="px-3 py-1.5"></th>
      {ITEM_COLUMNS.map((label) => (
        <th key={label} className={`px-2 py-1.5 font-semibold whitespace-nowrap ${label === 'Valor' ? 'text-right' : 'text-left'}`}>{label}</th>
      ))}
    </tr>
  );
}

/**
 * Lançamento dentro do DFC, nas mesmas 12 colunas dos demais blocos do Resumo
 * (Competência, Data efetiva, Descrição, Valor, Tipo, Categoria, Subcategoria,
 * Conta, Cartão, Contato, Centro, Status). São células da mesma tabela, sem
 * tabela aninhada, para a exportação Excel/PDF continuar lendo o DOM.
 */
function DfcItemRow({ item, type }: { item: ReportItemRow; type: string }) {
  return (
    <tr className="text-xs text-content-secondary border-b border-ui-border-soft/40 hover:bg-surface-subtle">
      <td className="px-3 py-1.5"></td>
      <td className="px-2 py-1.5 whitespace-nowrap">{formatDate(item.event_date)}</td>
      <td className="px-2 py-1.5 whitespace-nowrap">{formatDate(item.effective_date)}</td>
      <td className="px-2 py-1.5 min-w-[240px]">{item.description}</td>
      <td className="px-2 py-1.5 text-right whitespace-nowrap">{formatCurrency(item.amount)}</td>
      <td className="px-2 py-1.5 whitespace-nowrap">{type}</td>
      <td className="px-2 py-1.5">{dash(item.category?.name)}</td>
      <td className="px-2 py-1.5">{dash(item.subcategory?.name)}</td>
      <td className="px-2 py-1.5">{dash(item.financialInstitution?.name)}</td>
      <td className="px-2 py-1.5">{dash(item.card?.name)}</td>
      <td className="px-2 py-1.5">{dash(item.supplier?.name)}</td>
      <td className="px-2 py-1.5">{dash(item.center?.name)}</td>
      <td className="px-2 py-1.5 whitespace-nowrap">{STATUS_LABEL[item.status] ?? item.status}</td>
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
  reportKind: ReportKind;
  filters: ReportFiltersState;
  /** Oculta o título interno quando o cartão que hospeda a tabela já mostra um. */
  hideTitle?: boolean;
}

function formatSigned(value: number, sign: 1 | -1): string {
  const abs = formatCurrency(Math.abs(value));
  return sign < 0 ? `- ${abs}` : abs;
}

const DemonstrativoView = forwardRef<ReportViewHandle, DemonstrativoViewProps>(function DemonstrativoView(
  { dateRange, regime, filters, reportKind, hideTitle },
  ref
) {
  const tableRef = useRef<HTMLTableElement>(null);
  const [data, setData] = useState<DfcResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // O demonstrativo abre a receita/despesa por categoria (subcategoria) para
  // que Aluguéis, Restituição de IPTU, Impostos etc. fiquem visíveis no +.
  const groupBy: DfcGroupBy = 'subcategory';
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
        if (!cancelled) { setData(result.data as unknown as DfcResponse); setExpanded(new Set()); setExpandedGroups(new Set()); }
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
  }, [dateRange.from, dateRange.to, regime, filters]);

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

  // % comprometido em relação à Receita Bruta. Na linha de Resultado mostra o
  // total das despesas sobre a receita (acima de 100% = gastou mais do que faturou).
  const receitaBruta = data.lines.find((line) => line.key === 'receita_bruta')?.total ?? 0;
  const totalDespesas = data.lines
    .filter((line) => line.kind === 'line' && line.sign < 0)
    .reduce((sum, line) => sum + Math.abs(line.total), 0);
  const pctOf = (value: number): string => (receitaBruta > 0 ? formatPct((Math.abs(value) / receitaBruta) * 100) : '—');

  return (
    <div className="flex flex-col gap-4 p-4">
      {!hideTitle && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-sm font-semibold text-content">Demonstrativo Financeiro — Regime de {regime === 'caixa' ? 'Caixa' : 'Competência'}</h2>
        </div>
      )}

      {data.unclassifiedExpenseTotal > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-300/60 dark:border-amber-700/40 rounded-lg px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1.5 min-w-0">
            {/* O aviso antes só falava em "despesas sem classificação DFC", o
                que mandava o usuário procurar nos Lançamentos — onde não há o
                que classificar. A classificação é um campo da CATEGORIA. */}
            <span>
              {formatCurrency(data.unclassifiedExpenseTotal)} em despesas do período estão em categorias que
              não pertencem a nenhuma linha do DFC (Impostos / Despesa Variável / Despesa Fixa / Pessoal),
              então entram no resultado pela linha &ldquo;Outras Despesas (sem classificação DFC)&rdquo;.
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
              Não é nada no lançamento: abra{' '}
              <Link href="/dashboard/categorias" className="underline font-medium hover:opacity-80">
                Financeiro → Categorias
              </Link>
              , clique na categoria acima (aba Despesa) e escolha o campo
              &ldquo;Classificação no DFC&rdquo; para que ela apareça na linha correta.
            </span>
          </div>
        </div>
      )}

      <div className="bg-surface border border-ui-border-soft rounded-lg overflow-x-auto">
        <table ref={tableRef} className="w-full border-collapse min-w-[1100px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-content-muted border-b border-ui-border-soft/60">
              <th className="px-3 py-1.5 w-8"></th>
              <th colSpan={3} className="px-3 py-1.5 text-left font-semibold">Demonstrativo</th>
              <th className="px-2 py-1.5 text-right font-semibold">Valor</th>
              <th className="px-2 py-1.5 text-right font-semibold">%</th>
              <th colSpan={TABLE_COLUMNS - 5}></th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((line) => {
              const isExpandable = line.kind === 'line';
              const isOpen = reportKind === 'analitico' ? !expanded.has(line.key) : expanded.has(line.key);
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
                  <tr className={`border-b border-ui-border-soft/60 ${rowBg} ${line.kind === 'final' ? valueColor : ''}`}>
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
                    <td colSpan={3} className={`px-3 py-2 text-sm ${line.kind === 'line' ? 'text-content-secondary' : `font-bold ${line.kind === 'final' ? valueColor : 'text-content'}`}`}>
                      {line.kind === 'final' ? '= ' : line.kind === 'subtotal' ? '→ ' : ''}
                      {line.kind === 'final' ? `Resultado (${line.total < 0 ? 'Prejuízo' : 'Lucro'})` : line.label}
                    </td>
                    <td className={`px-2 py-2 text-sm text-right whitespace-nowrap font-semibold ${valueColor}`}>
                      {formatSigned(line.total, line.sign)}
                    </td>
                    <td className={`px-2 py-2 text-sm text-right whitespace-nowrap ${valueColor}`}>
                      {line.kind === 'line' && line.sign < 0
                        ? pctOf(line.total)
                        : line.kind === 'final'
                          ? (receitaBruta > 0 ? formatPct((totalDespesas / receitaBruta) * 100) : '—')
                          : ''}
                    </td>
                    <td colSpan={TABLE_COLUMNS - 5}></td>
                  </tr>
                  {isOpen &&
                    line.groups.map((g) => {
                      const groupKey = `${line.key}:${g.key}`;
                      const isGroupOpen = reportKind === 'analitico' ? !expandedGroups.has(groupKey) : expandedGroups.has(groupKey);
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
                            <td colSpan={3} className="px-3 py-1.5 pl-6">{g.label}</td>
                            <td className="px-2 py-1.5 text-right whitespace-nowrap">{formatCurrency(g.total)}</td>
                            <td className="px-2 py-1.5 text-right whitespace-nowrap">{line.sign < 0 ? pctOf(g.total) : ''}</td>
                            <td colSpan={TABLE_COLUMNS - 5}></td>
                          </tr>
                          {isGroupOpen && g.items.length > 0 && <DfcItemHeader />}
                          {isGroupOpen && g.items.map((item) => <DfcItemRow key={item.id} item={item} type={line.sign < 0 ? 'Despesa' : 'Receita'} />)}
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
