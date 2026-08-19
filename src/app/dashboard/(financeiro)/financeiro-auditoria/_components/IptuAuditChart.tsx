'use client';

import { useCallback, useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import ChartCard from '@/components/dashboard/ChartCard';
import EchartsSurface from '@/components/dashboard/EchartsSurface';
import { useTheme } from '@/contexts/ThemeContext';
import { getThemeTokens } from '@/utils';
import { buildCustomTooltipHTML, getCustomEchartsTooltipConfig } from '@/utils/echartsTooltip';
import type { IptuAuditRow } from './IptuAuditTable';

interface IptuAuditChartProps {
  rows: IptuAuditRow[];
  isLoading: boolean;
}

/**
 * Barras verticais por imóvel — receita (tom escuro) x despesa (tom claro), na
 * mesma cor de destaque usada no widget de Cartões de Crédito (Tarefa 4.1).
 */
export default function IptuAuditChart({ rows, isLoading }: IptuAuditChartProps) {
  useTheme();
  const tokens = getThemeTokens();

  // Só imóveis com movimento — barra zerada não diz nada e espreme as demais.
  const sortedRows = useMemo(
    () => rows.filter((r) => r.income !== 0 || r.expense !== 0).sort((a, b) => b.income - a.income),
    [rows],
  );

  const accentColor = tokens.chartSeries[0];

  const buildOption = useCallback((isLarge: boolean): EChartsOption => ({
    backgroundColor: 'transparent',
    tooltip: getCustomEchartsTooltipConfig((params) => {
      const itemsArray = Array.isArray(params) ? params : [params];
      const header = itemsArray[0]?.axisValueLabel || itemsArray[0]?.name || '';
      const items = itemsArray.map((item) => ({
        label: item.seriesName || '',
        value: Number(item.value ?? 0),
        color: item.color as string | undefined,
      }));
      return buildCustomTooltipHTML(header, items);
    }),
    legend: {
      top: 0,
      right: 0,
      icon: 'circle',
      itemGap: 16,
      textStyle: { color: tokens.textSecondary, fontSize: isLarge ? 12 : 11, fontWeight: 500 },
    },
    grid: {
      top: 40,
      bottom: isLarge ? 60 : 44,
      left: isLarge ? 40 : 10,
      right: isLarge ? 40 : 10,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: sortedRows.map((r) => r.propertyTitle),
      axisLabel: {
        color: tokens.textMuted,
        fontSize: isLarge ? 11 : 10,
        rotate: 35,
        interval: 0,
        width: 110,
        overflow: 'truncate',
      },
      axisLine: { lineStyle: { color: tokens.borderSoft } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: tokens.textMuted,
        fontSize: 11,
        formatter: (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }),
      },
      splitLine: { lineStyle: { type: 'dashed', color: tokens.borderSoft } },
    },
    series: [
      {
        name: 'Receita (Restituição)',
        type: 'bar',
        barMaxWidth: 32,
        data: sortedRows.map((r) => r.income),
        itemStyle: { borderRadius: [6, 6, 0, 0], color: accentColor },
      },
      {
        name: 'Despesa (IPTU Pago)',
        type: 'bar',
        barMaxWidth: 32,
        data: sortedRows.map((r) => r.expense),
        itemStyle: { borderRadius: [6, 6, 0, 0], color: `${accentColor}59` },
      },
    ],
  }), [sortedRows, tokens, accentColor]);

  // O ChartCard não desenha a moldura nem define altura: ele espera um pai
  // `flex flex-col` com altura. Sem isso o corpo do card fica com 0px e o
  // gráfico não aparece — era a causa do gráfico em branco (Tarefa 4.1).
  return (
    <div className="h-[340px] flex flex-col bg-surface border border-ui-border-soft rounded-xl shadow-sm overflow-hidden">
      <ChartCard title="RECEITA X DESPESA DE IPTU POR IMÓVEL" isDraggable={false}>
        {({ isFullscreen }) => (
          !isLoading && sortedRows.length === 0 ? (
            <div className="flex items-center justify-center h-full text-content-muted text-sm text-center px-4">
              Nenhum lançamento no período selecionado.
            </div>
          ) : (
            <div className="w-full h-full p-2 relative min-h-0">
              <EchartsSurface isFullscreen={isFullscreen} isLoading={isLoading} buildOption={buildOption} />
            </div>
          )
        )}
      </ChartCard>
    </div>
  );
}
