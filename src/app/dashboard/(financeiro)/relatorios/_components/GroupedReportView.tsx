'use client';

import { Fragment, forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { EChartsOption } from 'echarts';
import { ChevronUp, ChevronDown } from 'lucide-react';
import EchartsSurface from '@/components/dashboard/EchartsSurface';
import { useTheme } from '@/contexts/ThemeContext';
import { getThemeTokens } from '@/utils';
import { buildCustomTooltipHTML, getCustomEchartsTooltipConfig } from '@/utils/echartsTooltip';
import { formatCurrency } from '@/utils/formatters';
import { ReportDetailHeaderRow, ReportDetailRows, sortDetailItems, type DetailSortField, type DetailSortDir } from './ReportDetailTable';
import { buildReportActionParams } from '../_lib/buildReportQuery';
import { getGroupedReportAction } from '@/server/actions/financial-report';
import type { GroupedReportResponse, ReportFiltersState, ReportGroupBy, ReportKind, ReportRegime, ReportViewHandle } from '../_lib/types';

interface GroupedReportViewProps {
  title: string;
  groupColumnLabel: string;
  groupBy: ReportGroupBy;
  typeOverride: 'INCOME' | 'EXPENSE';
  accentColor: string;
  dateRange: { from: string; to: string };
  regime: ReportRegime;
  reportKind: ReportKind;
  filters: ReportFiltersState;
}

type SortField = 'label' | 'total';
type SortDir = 'asc' | 'desc';

const GroupedReportView = forwardRef<ReportViewHandle, GroupedReportViewProps>(function GroupedReportView(
  { title, groupColumnLabel, groupBy, typeOverride, accentColor, dateRange, regime, reportKind, filters },
  ref
) {
  useTheme();
  const tokens = getThemeTokens();
  const tableRef = useRef<HTMLTableElement>(null);

  const [data, setData] = useState<GroupedReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [detailSortField, setDetailSortField] = useState<DetailSortField | null>(null);
  const [detailSortDir, setDetailSortDir] = useState<DetailSortDir>('asc');

  useImperativeHandle(ref, () => ({
    getTableElement: () => tableRef.current,
  }));

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const raw = buildReportActionParams({ from: dateRange.from, to: dateRange.to, regime, filters, typeOverride });
        raw.groupBy = groupBy;
        const result = await getGroupedReportAction(raw);
        if (!result.ok) throw new Error(result.error);
        // A action serializa `event_date`/`effective_date: Date` para string no
        // round-trip servidor→cliente (JSON não tem tipo Date) — mesmo shape
        // que o fetch cru antigo já entregava, refletido em GroupedReportResponse.
        if (!cancelled) setData(result.data as unknown as GroupedReportResponse);
      } catch (error) {
        console.error('[GroupedReportView] Erro ao carregar relatório:', error);
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dateRange.from, dateRange.to, regime, groupBy, typeOverride, filters]);

  const groups = useMemo(() => data?.groups ?? [], [data]);

  const sortedGroups = useMemo(() => {
    if (!sortField) return groups;
    const copy = [...groups];
    copy.sort((a, b) => {
      const diff = sortField === 'label' ? a.label.localeCompare(b.label) : a.total - b.total;
      return sortDir === 'asc' ? diff : -diff;
    });
    return copy;
  }, [groups, sortField, sortDir]);

  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return field;
      }
      setSortDir('desc');
      return field;
    });
  }, []);

  const handleDetailSort = useCallback((field: DetailSortField) => {
    setDetailSortField((prev) => {
      if (prev === field) {
        setDetailSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return field;
      }
      setDetailSortDir('asc');
      return field;
    });
  }, []);

  const chartData = useMemo(
    () => [...groups].sort((a, b) => b.total - a.total).slice(0, 20),
    [groups]
  );

  /**
   * Barras horizontais: uma faixa por categoria (ate 20). Com altura fixa a
   * fonte maior dos rotulos colidia e o echarts escondia parte dos nomes —
   * entao a altura acompanha a quantidade de faixas. Pizza e barras por dia
   * nao empilham no eixo vertical e ficam na altura padrao.
   */
  const chartHeight = (() => {
    // Barras por dia: as faixas correm na horizontal, altura fixa serve.
    if (groupBy === 'day') return 288;
    // Pizza: a legenda embaixo quebra em linhas (~3 itens por linha) e a fonte
    // maior engorda cada linha — sem folga ela comia o proprio grafico.
    if (groupBy === 'category') {
      return 288 + Math.max(0, Math.ceil(chartData.length / 3) - 2) * 22;
    }
    return Math.max(288, chartData.length * 34 + 48);
  })();

  const buildOption = useCallback((isLarge: boolean): EChartsOption => {
    const tooltipConfig = getCustomEchartsTooltipConfig((params: any) => {
      const item = Array.isArray(params) ? params[0] : params;
      return buildCustomTooltipHTML(item.name ?? '', [
        { label: groupColumnLabel, value: formatCurrency(Number(item.value ?? 0)), color: item.color },
      ]);
    });

    if (groupBy === 'category') {
      return {
        backgroundColor: 'transparent',
        tooltip: { ...tooltipConfig, trigger: 'item' },
        legend: { bottom: 0, textStyle: { color: tokens.textMuted, fontSize: 12 } },
        series: [
          {
            type: 'pie',
            radius: ['45%', '70%'],
            center: ['50%', '45%'],
            data: chartData.map((g, i) => ({
              name: g.label,
              value: g.total,
              itemStyle: { color: tokens.chartSeries[i % tokens.chartSeries.length] },
            })),
            label: {
              formatter: (p: any) => formatCurrency(p.value),
              color: tokens.textPrimary,
              fontSize: isLarge ? 15 : 13,
            },
          },
        ],
      };
    }

    if (groupBy === 'day') {
      return {
        backgroundColor: 'transparent',
        tooltip: tooltipConfig,
        grid: { top: 24, bottom: 40, left: 16, right: 16, containLabel: true },
        xAxis: {
          type: 'category',
          data: chartData.map((g) => g.label),
          axisLabel: { color: tokens.textMuted, fontSize: isLarge ? 14 : 12 },
          axisLine: { lineStyle: { color: tokens.borderSoft } },
        },
        yAxis: {
          type: 'value',
          axisLabel: { color: tokens.textMuted, fontSize: 12, formatter: (v: number) => formatCurrency(v) },
          splitLine: { lineStyle: { color: tokens.borderSoft } },
        },
        series: [
          {
            type: 'bar',
            data: chartData.map((g) => g.total),
            barMaxWidth: 40,
            itemStyle: { borderRadius: [6, 6, 0, 0], color: accentColor },
          },
        ],
      };
    }

    // horizontal bar (description, subcategory, contact, center)
    const ordered = [...chartData].reverse();
    return {
      backgroundColor: 'transparent',
      tooltip: tooltipConfig,
      grid: { top: 16, bottom: 16, left: 16, right: 88, containLabel: true },
      xAxis: {
        type: 'value',
        axisLabel: { color: tokens.textMuted, fontSize: 12, formatter: (v: number) => formatCurrency(v) },
        splitLine: { lineStyle: { color: tokens.borderSoft } },
      },
      yAxis: {
        type: 'category',
        data: ordered.map((g) => g.label),
        axisLabel: { color: tokens.textMuted, fontSize: isLarge ? 14 : 12, width: 260, overflow: 'break' },
        axisLine: { lineStyle: { color: tokens.borderSoft } },
      },
      series: [
        {
          type: 'bar',
          data: ordered.map((g) => g.total),
          barMaxWidth: 22,
          itemStyle: { borderRadius: [0, 6, 6, 0], color: accentColor },
          label: {
            show: true,
            position: 'right',
            formatter: (p: any) => formatCurrency(p.value),
            color: tokens.textPrimary,
            fontSize: 12,
          },
        },
      ],
    };
  }, [chartData, groupBy, groupColumnLabel, accentColor, tokens]);

  const SortIcon = ({ field }: { field: SortField }) =>
    sortField === field ? (
      sortDir === 'asc' ? <ChevronUp size={12} className="inline ml-1" /> : <ChevronDown size={12} className="inline ml-1" />
    ) : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-content-muted text-sm">
        Nenhum lançamento encontrado para o período e filtros selecionados.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="bg-surface border border-ui-border-soft rounded-lg p-2">
        <h2 className="text-sm font-semibold text-content px-2 pt-1 pb-2">{title}</h2>
        <div className="relative" style={{ height: chartHeight }}>
          <EchartsSurface isFullscreen={false} isLoading={false} buildOption={buildOption} />
        </div>
      </div>

      <div className="bg-surface border border-ui-border-soft rounded-lg overflow-x-auto">
        <table ref={tableRef} className="w-full border-collapse">
          <thead>
            {reportKind === 'sintetico' ? (
              <tr className="text-left text-[11px] font-semibold text-content-muted uppercase tracking-wide border-b border-ui-border-soft">
                <th className="px-3 py-2 cursor-pointer select-none" onClick={() => handleSort('label')}>
                  {groupColumnLabel}
                  <SortIcon field="label" />
                </th>
                <th className="px-3 py-2 text-right cursor-pointer select-none" onClick={() => handleSort('total')}>
                  Valor
                  <SortIcon field="total" />
                </th>
              </tr>
            ) : (
              <ReportDetailHeaderRow sortField={detailSortField} sortDir={detailSortDir} onSort={handleDetailSort} />
            )}
          </thead>
          <tbody>
            {reportKind === 'sintetico'
              ? sortedGroups.map((g) => (
                  <tr key={g.key} className="text-sm text-content-secondary border-b border-ui-border-soft/60 hover:bg-surface-subtle">
                    <td className="px-3 py-2">{g.label}</td>
                    <td className="px-3 py-2 text-right font-medium text-content">{formatCurrency(g.total)}</td>
                  </tr>
                ))
              : sortedGroups.map((g) => (
                  <Fragment key={g.key}>
                    <tr className="text-sm font-semibold text-content bg-surface-subtle border-b border-ui-border-soft">
                      <td className="px-3 py-1.5" colSpan={10}>{g.label}</td>
                      <td className="px-3 py-1.5 text-right">{formatCurrency(g.total)}</td>
                    </tr>
                    <ReportDetailRows items={sortDetailItems(g.items, detailSortField, detailSortDir)} />
                  </Fragment>
                ))}
          </tbody>
          <tfoot>
            <tr className="text-sm font-bold text-content bg-surface-subtle border-t-2 border-ui-border">
              <td className="px-3 py-2.5" colSpan={reportKind === 'analitico' ? 10 : 1}>Total Geral</td>
              <td className="px-3 py-2.5 text-right font-bold text-brand">{formatCurrency(data?.totalGeral ?? 0)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
});

export default GroupedReportView;
