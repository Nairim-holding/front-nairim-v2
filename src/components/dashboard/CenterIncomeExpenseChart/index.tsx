'use client';
import { useEffect, useState } from 'react';
import type { EChartsOption } from 'echarts';
import ChartCard from '@/components/dashboard/ChartCard';
import EchartsSurface from '@/components/dashboard/EchartsSurface';
import { getCenterSummaryAction } from '@/server/actions/center-summary';
import type { CenterSummaryRow } from '@/core/entities/center-summary';
import type { FinancialWidgetProps } from '@/components/dashboard/FinancialDashboardGrid/types';
import { formatCurrency, getThemeTokens } from '@/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { buildCustomTooltipHTML, getCustomEchartsTooltipConfig } from '@/utils/echartsTooltip';

export default function CenterIncomeExpenseChart({ startDate, endDate, filters }: FinancialWidgetProps) {
  useTheme(); const tokens = getThemeTokens();
  const queryKey = JSON.stringify([startDate, endDate, filters]);
  const [result, setResult] = useState<{ key: string; rows: CenterSummaryRow[]; error: string } | null>(null);
  const loading = result?.key !== queryKey;
  const rows = loading ? [] : result.rows;
  const error = loading ? '' : result.error;
  useEffect(() => {
    let cancelled = false;
    getCenterSummaryAction({ ...filters, startDate, endDate, regime: filters?.regime ?? 'caixa' }).then(result => {
      if (cancelled) return;
      setResult({ key: queryKey, rows: result.ok ? result.data : [], error: result.ok ? '' : result.error });
    }).catch(() => { if (!cancelled) setResult({ key: queryKey, rows: [], error: 'Não foi possível carregar o gráfico' }); });
    return () => { cancelled = true; };
  }, [startDate, endDate, filters, queryKey]);
  const buildOption = (): EChartsOption => ({
    tooltip: getCustomEchartsTooltipConfig(params => {
      const item = Array.isArray(params) ? params[0] : params; const row = rows[item.dataIndex];
      return buildCustomTooltipHTML(row?.name ?? '', [ { label: 'Receitas', value: formatCurrency(row?.income ?? 0), color: '#059669' }, { label: 'Despesas', value: formatCurrency(row?.expense ?? 0), color: '#dc2626' } ]);
    }), legend: { top: 0, left: 'center', data: ['Receitas','Despesas'], textStyle: { color: tokens.textMuted } },
    grid: { left: 12, right: 30, top: 38, bottom: rows.length > 12 ? 55 : 20, containLabel: true },
    xAxis: { type: 'value', axisLabel: { color: tokens.textMuted, formatter: (v: number) => formatCurrency(v) }, splitLine: { lineStyle: { color: tokens.borderSoft } } },
    yAxis: { type: 'category', inverse: true, data: rows.map(row => row.name), axisLabel: { color: tokens.textMuted, width: 170, overflow: 'truncate' } },
    ...(rows.length > 12 ? { dataZoom: [{ type: 'slider' as const, yAxisIndex: 0, right: 0, start: 0, end: Math.min(100,1200/rows.length), filterMode: 'filter' as const }] } : {}),
    series: [ { name: 'Receitas', type: 'bar', data: rows.map(row => row.income), itemStyle: { color: '#059669' }, barMaxWidth: 16 }, { name: 'Despesas', type: 'bar', data: rows.map(row => row.expense), itemStyle: { color: '#dc2626' }, barMaxWidth: 16 } ],
  });
  return <ChartCard title="Receitas e despesas por centro" subtitle={`${filters?.regime === 'competencia' ? 'Por competência' : 'Por data efetiva'}, sem transferências`} detailData={rows} detailColumns={[
    { key: 'name', label: 'Centro' }, { key: 'income', label: 'Receitas', format: formatCurrency, summable: true },
    { key: 'expense', label: 'Despesas', format: formatCurrency, summable: true }, { key: 'balance', label: 'Resultado', format: formatCurrency, summable: true },
  ]}>{({ isFullscreen }) => error ? <div role="alert" className="p-4 text-sm text-red-600">{error}</div> : !loading && !rows.length ? <div className="p-8 text-sm text-content-muted">Sem lançamentos no período.</div> : <EchartsSurface isFullscreen={isFullscreen} isLoading={loading} buildOption={buildOption} />}</ChartCard>;
}
