'use client';

import { useCallback, useMemo, useState } from 'react';
import type { IptuAuditRow } from '@/core/entities/iptu-audit';
import type { EChartsOption } from 'echarts';
import ChartCard from '@/components/dashboard/ChartCard';
import EchartsSurface from '@/components/dashboard/EchartsSurface';
import { useTheme } from '@/contexts/ThemeContext';
import { getThemeTokens } from '@/utils';
import { buildCustomTooltipHTML, getCustomEchartsTooltipConfig } from '@/utils/echartsTooltip';

export interface IptuAuditPeriodPoint {
  key: string;
  label: string;
  income: number;
  expense: number;
  balance: number;
}

interface IptuAuditComparativeChartProps {
  rows: IptuAuditRow[];
  monthly: IptuAuditPeriodPoint[];
  yearly: IptuAuditPeriodPoint[];
  isLoading: boolean;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Comparativo, por mês ou por ano, entre o IPTU pago pela empresa (despesa) e a
 * restituição recebida dos inquilinos (receita), com a linha de saldo — é o que
 * mostra se os repasses estão corretos ou se há prejuízo (Tarefa 4.1).
 */
export default function IptuAuditComparativeChart({ rows, monthly, yearly, isLoading }: IptuAuditComparativeChartProps) {
  useTheme();
  const tokens = getThemeTokens();
  const [mode, setMode] = useState<'month' | 'year'>('month');

  const points = mode === 'month' ? monthly : yearly;

  const incomeColor = tokens.chartSeries[1];
  const expenseColor = tokens.chartSeries[0];

  const buildOption = useCallback(
    (isLarge: boolean): EChartsOption => ({
      backgroundColor: 'transparent',
      tooltip: getCustomEchartsTooltipConfig((params) => {
        const itemsArray = Array.isArray(params) ? params : [params];
        const header = itemsArray[0]?.axisValueLabel || itemsArray[0]?.name || '';
        return buildCustomTooltipHTML(
          header,
          itemsArray.map((item) => ({
            label: item.seriesName || '',
            value: Number(item.value ?? 0),
            color: item.color as string | undefined,
          })),
        );
      }),
      legend: {
        top: 0,
        right: 0,
        icon: 'circle',
        itemGap: 14,
        textStyle: { color: tokens.textSecondary, fontSize: isLarge ? 12 : 11, fontWeight: 500 },
      },
      grid: { top: 40, bottom: 30, left: 10, right: 10, containLabel: true },
      xAxis: {
        type: 'category',
        data: points.map((p) => p.label),
        axisLabel: { color: tokens.textMuted, fontSize: isLarge ? 11 : 10, interval: 0, rotate: points.length > 8 ? 35 : 0 },
        axisLine: { lineStyle: { color: tokens.borderSoft } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: tokens.textMuted,
          fontSize: 11,
          formatter: (value: number) =>
            value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }),
        },
        splitLine: { lineStyle: { type: 'dashed', color: tokens.borderSoft } },
      },
      series: [
        {
          name: 'Restituição recebida',
          type: 'bar',
          barMaxWidth: 26,
          data: points.map((p) => p.income),
          itemStyle: { borderRadius: [5, 5, 0, 0], color: incomeColor },
        },
        {
          name: 'IPTU pago pela empresa',
          type: 'bar',
          barMaxWidth: 26,
          data: points.map((p) => p.expense),
          itemStyle: { borderRadius: [5, 5, 0, 0], color: expenseColor },
        },
        {
          name: 'Saldo',
          type: 'line',
          smooth: true,
          symbolSize: 6,
          data: points.map((p) => p.balance),
          lineStyle: { width: 2, color: tokens.brandPrimary },
          itemStyle: { color: tokens.brandPrimary },
        },
      ],
    }),
    [points, tokens, incomeColor, expenseColor],
  );

  const detailData = useMemo(
    () => rows.flatMap(row => row.transactions.map(transaction => {
      const key = transaction.date.slice(0, mode === 'month' ? 7 : 4);
      return {
        id: transaction.id,
        periodo: points.find(point => point.key === key)?.label ?? key,
        date: transaction.date,
        property: row.propertyTitle,
        propertyType: row.propertyType ?? 'Não informado',
        tenant: transaction.tenantName ?? 'Sem inquilino vinculado',
        contract: transaction.contractNumber ?? '—',
        description: transaction.description,
        income: transaction.type === 'INCOME' ? transaction.amount : 0,
        expense: transaction.type === 'EXPENSE' ? transaction.amount : 0,
        balance: transaction.type === 'INCOME' ? transaction.amount : -transaction.amount,
      };
    })).sort((a, b) => a.date.localeCompare(b.date) || a.property.localeCompare(b.property, 'pt-BR')),
    [rows, points, mode],
  );

  const detailColumns = useMemo(
    () => [
      { key: 'date', label: 'Data', format: (v: string) => v.split('-').reverse().join('/') },
      { key: 'property', label: 'Imóvel' },
      { key: 'propertyType', label: 'Tipo do imóvel' },
      { key: 'tenant', label: 'Inquilino' },
      { key: 'contract', label: 'Contrato' },
      { key: 'description', label: 'Lançamento' },
      { key: 'income', label: 'Restituição recebida', format: (v: number) => formatCurrency(v), summable: true },
      { key: 'expense', label: 'IPTU pago', format: (v: number) => formatCurrency(v), summable: true },
      { key: 'balance', label: 'Saldo', format: (v: number) => formatCurrency(v), summable: true },
    ],
    [],
  );

  return (
    <div className="h-[340px] flex flex-col bg-surface border border-ui-border-soft rounded-xl shadow-sm overflow-hidden">
      <ChartCard
        title="IPTU PAGO x RESTITUIÇÃO RECEBIDA"
        isDraggable={false}
        detailData={detailData}
        detailColumns={detailColumns}
        detailGroupBy={{ key: 'periodo', order: points.map(point => point.label) }}
        detailTotalLabel="lançamentos"
      >
        {({ isFullscreen }) =>
          !isLoading && points.length === 0 ? (
            <div className="flex items-center justify-center h-full text-content-muted text-sm text-center px-4">
              Nenhum lançamento de IPTU no período selecionado.
            </div>
          ) : (
            <div className="w-full h-full p-2 relative min-h-0">
              <div className="absolute top-1 left-2 z-10 flex rounded-md border border-ui-border overflow-hidden">
                {(['month', 'year'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                      mode === m ? 'bg-brand text-content-inverse' : 'bg-surface text-content-secondary hover:bg-surface-subtle'
                    }`}
                  >
                    {m === 'month' ? 'Por mês' : 'Por ano'}
                  </button>
                ))}
              </div>
              <EchartsSurface isFullscreen={isFullscreen} isLoading={isLoading} buildOption={buildOption} />
            </div>
          )
        }
      </ChartCard>
    </div>
  );
}
