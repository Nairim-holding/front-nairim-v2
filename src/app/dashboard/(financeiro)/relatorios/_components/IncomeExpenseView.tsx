'use client';

import { Fragment, forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { EChartsOption } from 'echarts';
import EchartsSurface from '@/components/dashboard/EchartsSurface';
import { useTheme } from '@/contexts/ThemeContext';
import { getThemeTokens } from '@/utils';
import { buildCustomTooltipHTML, getCustomEchartsTooltipConfig } from '@/utils/echartsTooltip';
import { authFetch } from '@/utils/authFetch';
import { formatCurrency } from '@/utils/formatters';
import { ReportDetailHeaderRow, ReportDetailRows, sortDetailItems, type DetailSortField, type DetailSortDir } from './ReportDetailTable';
import { buildReportQuery } from '../_lib/buildReportQuery';
import type { IncomeExpenseResponse, IncomeExpenseSide, ReportFiltersState, ReportKind, ReportRegime, ReportViewHandle } from '../_lib/types';

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

interface IncomeExpenseViewProps {
  dateRange: { from: string; to: string };
  regime: ReportRegime;
  reportKind: ReportKind;
  filters: ReportFiltersState;
}

function MiniBarChart({ side, color }: { side: IncomeExpenseSide; color: string }) {
  const tokens = getThemeTokens();
  const chartData = useMemo(() => [...side.groups].sort((a, b) => b.total - a.total).slice(0, 15).reverse(), [side.groups]);

  const buildOption = (): EChartsOption => ({
    backgroundColor: 'transparent',
    tooltip: getCustomEchartsTooltipConfig((params: any) => {
      const item = Array.isArray(params) ? params[0] : params;
      const g = chartData[item.dataIndex];
      return buildCustomTooltipHTML(g?.category ?? item.name ?? '', [
        { label: 'Categoria', value: formatCurrency(g?.total ?? item.value ?? 0), color },
      ]);
    }),
    grid: { top: 16, bottom: 16, left: 16, right: 60, containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { color: tokens.textMuted, fontSize: 10, formatter: (v: number) => formatCurrency(v) },
      splitLine: { lineStyle: { color: tokens.borderSoft } },
    },
    yAxis: {
      type: 'category',
      data: chartData.map((g) => g.category),
      axisLabel: { color: tokens.textMuted, fontSize: 10, width: 140, overflow: 'truncate' },
      axisLine: { lineStyle: { color: tokens.borderSoft } },
    },
    series: [
      {
        type: 'bar',
        data: chartData.map((g) => g.total),
        barMaxWidth: 20,
        itemStyle: { borderRadius: [0, 6, 6, 0], color },
        label: { show: true, position: 'right', formatter: (p: any) => formatCurrency(p.value), color: tokens.textPrimary, fontSize: 10 },
      },
    ],
  });

  if (side.groups.length === 0) {
    return <div className="flex items-center justify-center h-40 text-content-muted text-xs">Sem lançamentos no período.</div>;
  }

  return (
    <div className="h-64 relative">
      <EchartsSurface isFullscreen={false} isLoading={false} buildOption={buildOption} />
    </div>
  );
}

function SideTable({
  side,
  label,
  reportKind,
  detailSortField,
  detailSortDir,
}: {
  side: IncomeExpenseSide;
  label: string;
  reportKind: ReportKind;
  detailSortField: DetailSortField | null;
  detailSortDir: DetailSortDir;
}) {
  return (
    <>
      <tr className="text-xs font-bold text-content-inverse bg-brand">
        <td className="px-3 py-1.5" colSpan={11}>
          {label} — {formatCurrency(side.total)}
        </td>
      </tr>
      {side.groups.length === 0 && (
        <tr>
          <td colSpan={11} className="px-3 py-3 text-center text-content-muted text-xs">Nenhum lançamento.</td>
        </tr>
      )}
      {reportKind === 'sintetico'
        ? side.groups.map((g) => (
            <tr key={g.categoryId} className="text-sm text-content-secondary border-b border-ui-border-soft/60">
              <td className="px-3 py-1.5" colSpan={10}>{g.category}</td>
              <td className="px-3 py-1.5 text-right font-medium text-content">{formatCurrency(g.total)}</td>
            </tr>
          ))
        : side.groups.map((g) => (
            <Fragment key={g.categoryId}>
              <tr className="text-sm font-semibold text-content bg-surface-subtle border-b border-ui-border-soft">
                <td className="px-3 py-1.5" colSpan={10}>{g.category}</td>
                <td className="px-3 py-1.5 text-right">{formatCurrency(g.total)}</td>
              </tr>
              <ReportDetailRows items={sortDetailItems(g.items, detailSortField, detailSortDir)} />
            </Fragment>
          ))}
    </>
  );
}

const IncomeExpenseView = forwardRef<ReportViewHandle, IncomeExpenseViewProps>(function IncomeExpenseView(
  { dateRange, regime, reportKind, filters },
  ref
) {
  useTheme();
  const tableRef = useRef<HTMLTableElement>(null);
  const [data, setData] = useState<IncomeExpenseResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [detailSortField, setDetailSortField] = useState<DetailSortField | null>(null);
  const [detailSortDir, setDetailSortDir] = useState<DetailSortDir>('asc');

  useImperativeHandle(ref, () => ({
    getTableElement: () => tableRef.current,
  }));

  const handleDetailSort = (field: DetailSortField) => {
    setDetailSortField((prev) => {
      if (prev === field) {
        setDetailSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return field;
      }
      setDetailSortDir('asc');
      return field;
    });
  };

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const qs = buildReportQuery({ from: dateRange.from, to: dateRange.to, regime, filters });
        const res = await authFetch(`${API_URL}/financial-reports/income-expense?${qs.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setData(json.data ?? json);
      } catch (error) {
        console.error('[IncomeExpenseView] Erro ao carregar receitas/despesas:', error);
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dateRange.from, dateRange.to, regime, filters]);

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
      <h2 className="text-sm font-semibold text-content">Receitas / Despesas</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-surface border border-ui-border-soft rounded-lg p-2">
          <h3 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 px-2 pt-1 pb-1">Receitas</h3>
          <MiniBarChart side={data.receitas} color="#10b981" />
        </div>
        <div className="bg-surface border border-ui-border-soft rounded-lg p-2">
          <h3 className="text-xs font-semibold text-red-600 dark:text-red-400 px-2 pt-1 pb-1">Despesas</h3>
          <MiniBarChart side={data.despesas} color="#ef4444" />
        </div>
      </div>

      <div className="bg-surface border border-ui-border-soft rounded-lg overflow-x-auto">
        <table ref={tableRef} className="w-full border-collapse">
          <thead>
            {reportKind === 'sintetico' ? (
              <tr className="text-left text-[11px] font-semibold text-content-muted uppercase tracking-wide border-b border-ui-border-soft">
                <th className="px-3 py-2" colSpan={10}>Categoria</th>
                <th className="px-3 py-2 text-right">Valor</th>
              </tr>
            ) : (
              <ReportDetailHeaderRow sortField={detailSortField} sortDir={detailSortDir} onSort={handleDetailSort} />
            )}
          </thead>
          <tbody>
            <SideTable side={data.receitas} label="Receitas" reportKind={reportKind} detailSortField={detailSortField} detailSortDir={detailSortDir} />
            <SideTable side={data.despesas} label="Despesas" reportKind={reportKind} detailSortField={detailSortField} detailSortDir={detailSortDir} />
          </tbody>
        </table>
      </div>

      <div className="bg-surface border border-ui-border-soft rounded-lg p-4 max-w-md ml-auto w-full text-sm space-y-1.5">
        <div className="flex justify-between">
          <span className="text-content-secondary">Saldo Anterior</span>
          <span className="font-medium text-content">{formatCurrency(data.summary.saldoAnterior)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-content-secondary">Total de Receitas no Período</span>
          <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(data.summary.totalReceitas)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-content-secondary">Total de Despesas no Período</span>
          <span className="font-medium text-red-600 dark:text-red-400">{formatCurrency(data.summary.totalDespesas)}</span>
        </div>
        <div className="flex justify-between border-t border-ui-border-soft pt-1.5">
          <span className="text-content-secondary">Balanço no Período</span>
          <span className={`font-semibold ${data.summary.balancoPeriodo < 0 ? 'text-red-600 dark:text-red-400' : 'text-content'}`}>
            {formatCurrency(data.summary.balancoPeriodo)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-content-secondary font-semibold">Saldo Final</span>
          <span className={`font-bold ${data.summary.saldoFinal < 0 ? 'text-red-600 dark:text-red-400' : 'text-content'}`}>
            {formatCurrency(data.summary.saldoFinal)}
          </span>
        </div>
      </div>
    </div>
  );
});

export default IncomeExpenseView;
