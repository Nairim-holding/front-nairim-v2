'use client';

import { useCallback } from 'react';
import type { EChartsOption } from 'echarts';
import EchartsSurface from '@/components/dashboard/EchartsSurface';
import { getThemeTokens } from '@/utils';
import { buildCustomTooltipHTML, getCustomEchartsTooltipConfig } from '@/utils/echartsTooltip';

export interface DualColorBarItem {
  label: string;
  /** Barra clara: referência/capacidade (planejado, limite). */
  reference: number;
  /** Barra escura: valor consumido/realizado. */
  actual: number;
  /** Percentual já calculado por quem consome (controla as casas decimais). */
  percentage: number;
}

interface DualColorBarChartProps {
  items: DualColorBarItem[];
  referenceLabel: string;
  actualLabel: string;
  /** Cor base (a barra clara é uma versão translúcida desta mesma cor). */
  color?: string;
  isFullscreen: boolean;
  isLoading?: boolean;
  valueFormatter: (value: number) => string;
}

// Rótulos do eixo X curtos (ex.: "R$ 2 mil") em vez do valor formatado por
// extenso — com vários ticks lado a lado num card compacto, "R$ 2.000,00 R$
// 4.000,00 ..." não cabe e os textos ficam colados/sobrepostos uns nos outros.
function formatAxisValue(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `R$ ${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  }
  return `R$ ${value.toLocaleString('pt-BR')}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const sanitized = hex.replace('#', '');
  const normalized = sanitized.length === 3
    ? sanitized.split('').map((c) => c + c).join('')
    : sanitized;
  const bigint = parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Barra horizontal bicolor (estilo "bullet chart"): duas séries na mesma linha,
 * a clara (referência/capacidade) atrás e mais larga, a escura (realizado/consumido)
 * na frente e mais estreita, sobrepostas via barGap: '-100%'. Quando o valor
 * realizado ultrapassa a referência, a barra escura simplesmente se estende além
 * da clara — sem necessidade de tratamento especial.
 *
 * O percentual vai no rótulo do eixo Y (não anexado à ponta da barra) porque a
 * ponta da barra escura muda de posição conforme o valor, o que faria o rótulo
 * "pular" de lugar e por vezes ficar sobre a barra clara.
 */
export default function DualColorBarChart({
  items,
  referenceLabel,
  actualLabel,
  color,
  isFullscreen,
  isLoading,
  valueFormatter,
}: DualColorBarChartProps) {
  const tokens = getThemeTokens();
  const baseColor = color ?? tokens.chartSeries[0];
  const lightColor = hexToRgba(baseColor, 0.3);

  const buildOption = useCallback((isLarge: boolean): EChartsOption => {
    // Ordem ascendente: com eixo de categoria normal (não invertido), o maior
    // percentual acaba desenhado no topo.
    const sorted = [...items].sort((a, b) => a.percentage - b.percentage);

    return {
      backgroundColor: 'transparent',
      tooltip: getCustomEchartsTooltipConfig((params: any) => {
        const item = sorted[params[0]?.dataIndex ?? 0];
        if (!item) return '';
        return buildCustomTooltipHTML(item.label, [
          { label: referenceLabel, value: item.reference, color: lightColor },
          { label: actualLabel, value: item.actual, color: baseColor, formattedValue: `${valueFormatter(item.actual)} (${item.percentage.toFixed(1)}%)` },
        ]);
      }),
      legend: {
        data: [referenceLabel, actualLabel],
        top: 0,
        textStyle: { color: tokens.textSecondary, fontSize: isLarge ? 13 : 11 },
      },
      // containLabel:true já reserva, sozinho, o espaço necessário para o texto
      // dos rótulos do eixo Y — declarar um `left` grande (170/220px) além disso
      // soma as duas margens (a fixa + a calculada), sobrando um vão vazio entre
      // o fim do texto e o início das barras. left pequeno deixa o containLabel
      // fazer essa conta sozinho, e right um pouco maior evita que o último tick
      // do eixo X (ex.: "R$ 9 mil") seja cortado na borda do card.
      grid: {
        top: 40,
        bottom: isLarge ? 24 : 20,
        left: 8,
        right: isLarge ? 40 : 28,
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        // splitNumber pequeno mantém poucos ticks (o eixo é curto num card
        // compacto) e hideOverlap descarta qualquer rótulo que ainda assim
        // colida com o vizinho, em vez de deixá-los se sobrepor ilegivelmente.
        splitNumber: isLarge ? 5 : 3,
        axisLabel: {
          color: tokens.textMuted,
          fontSize: isLarge ? 11 : 10,
          formatter: (v: number) => formatAxisValue(v),
          hideOverlap: true,
        },
        splitLine: { lineStyle: { type: 'dashed', color: tokens.borderSoft } },
      },
      yAxis: {
        type: 'category',
        data: sorted.map((i) => `${i.label}  (${i.percentage.toFixed(1)}%)`),
        axisLabel: { color: tokens.textMuted, fontSize: isLarge ? 13 : 11 },
        axisLine: { lineStyle: { color: tokens.borderSoft } },
        axisTick: { show: false },
      },
      series: [
        {
          name: referenceLabel,
          type: 'bar',
          data: sorted.map((i) => i.reference),
          barWidth: isLarge ? 22 : 16,
          itemStyle: { color: lightColor, borderRadius: 10 },
          z: 1,
        },
        {
          name: actualLabel,
          type: 'bar',
          data: sorted.map((i) => i.actual),
          barWidth: isLarge ? 22 : 16,
          barGap: '-100%',
          itemStyle: { color: baseColor, borderRadius: 10 },
          z: 2,
        },
      ],
    };
  }, [items, referenceLabel, actualLabel, baseColor, lightColor, tokens, valueFormatter]);

  return <EchartsSurface isFullscreen={isFullscreen} isLoading={isLoading} buildOption={buildOption} />;
}
