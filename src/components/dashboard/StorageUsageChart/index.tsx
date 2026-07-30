'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import ChartCard from '@/components/dashboard/ChartCard';
import EchartsSurface from '@/components/dashboard/EchartsSurface';
import { authFetch } from '@/utils/authFetch';
import { useTheme } from '@/contexts/ThemeContext';
import { getThemeTokens } from '@/utils';
import { buildCustomTooltipHTML, getCustomEchartsTooltipConfig } from '@/utils/echartsTooltip';

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

interface StorageGroup {
  key: string;
  label: string;
  bytes: number;
  megabytes: number;
  files: number;
}

/** Sempre 2 casas, separador decimal pt-BR — ex.: 22,34 MB. */
export function formatMegabytes(value: number): string {
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MB`;
}

/** Subconjunto do payload de callback do echarts que este gráfico usa. */
interface TooltipParam {
  dataIndex: number;
  name?: string;
  color?: string;
}

interface StorageUsageChartProps {
  /** Sem moldura própria: o pai fornece o cartão (padrão do ChartCard). */
  isDraggable?: boolean;
}

export default function StorageUsageChart({ isDraggable = false }: StorageUsageChartProps) {
  useTheme();
  const tokens = getThemeTokens();

  const [groups, setGroups] = useState<StorageGroup[]>([]);
  const [totalMegabytes, setTotalMegabytes] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const response = await authFetch(`${API_URL}/dashboard/storage`);
        if (response.ok) {
          const result = await response.json();
          if (!cancelled) {
            setGroups(Array.isArray(result.data?.groups) ? result.data.groups : []);
            setTotalMegabytes(Number(result.data?.totalMegabytes ?? 0));
            setTotalFiles(Number(result.data?.totalFiles ?? 0));
          }
        }
      } catch (error) {
        console.error('[StorageUsageChart] Erro ao carregar consumo de armazenamento:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Maior em cima: no eixo Y do echarts o índice 0 fica embaixo, então a ordem
  // enviada é crescente para o gráfico sair decrescente de cima para baixo.
  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => a.megabytes - b.megabytes),
    [groups]
  );

  const detailData = useMemo(
    () => [
      ...[...groups]
        .sort((a, b) => b.megabytes - a.megabytes)
        .map((group) => ({ label: group.label, megabytes: group.megabytes, files: group.files })),
      { label: 'Total', megabytes: totalMegabytes, files: totalFiles },
    ],
    [groups, totalMegabytes, totalFiles]
  );

  const detailColumns = useMemo(
    () => [
      { key: 'label', label: 'Local' },
      { key: 'megabytes', label: 'Tamanho (MB)', format: (v: number) => formatMegabytes(v) },
      { key: 'files', label: 'Qtde de arquivos' },
    ],
    []
  );

  const buildOption = useCallback((isLarge: boolean): EChartsOption => ({
    backgroundColor: 'transparent',
    tooltip: getCustomEchartsTooltipConfig((params: TooltipParam | TooltipParam[]) => {
      const item = Array.isArray(params) ? params[0] : params;
      const group = sortedGroups[item.dataIndex];
      const share = totalMegabytes > 0 ? Math.round(((group?.megabytes ?? 0) / totalMegabytes) * 1000) / 10 : 0;
      return buildCustomTooltipHTML(group?.label ?? item.name ?? '', [
        {
          label: 'Espaço',
          value: formatMegabytes(group?.megabytes ?? 0),
          color: item.color,
          formattedValue: `${formatMegabytes(group?.megabytes ?? 0)} (${share}%) · ${group?.files ?? 0} arquivo(s)`,
        },
      ]);
    }),
    grid: {
      top: 20,
      bottom: 20,
      left: 16,
      // Espaço à direita para o rótulo em MB não ser cortado na ponta da barra.
      right: isLarge ? 96 : 80,
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      show: false,
    },
    yAxis: {
      type: 'category',
      data: sortedGroups.map((group) => group.label),
      axisLabel: {
        color: tokens.textMuted,
        fontSize: isLarge ? 12 : 11,
        fontWeight: 500,
      },
      axisLine: { lineStyle: { color: tokens.borderSoft } },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        // Cor e rótulo por item (em vez de callbacks): o valor formatado em pt-BR
        // já sai pronto daqui, sem precisar reformatar dentro do echarts.
        data: sortedGroups.map((group, index) => ({
          value: group.megabytes,
          itemStyle: { color: tokens.chartSeries[index % tokens.chartSeries.length] },
          label: { formatter: formatMegabytes(group.megabytes) },
        })),
        barMaxWidth: isLarge ? 40 : 28,
        itemStyle: {
          borderRadius: [0, 10, 10, 0],
        },
        label: {
          show: true,
          position: 'right',
          color: tokens.textPrimary,
          fontSize: isLarge ? 12 : 11,
          fontWeight: 'bold',
        },
      },
    ],
  }), [sortedGroups, totalMegabytes, tokens]);

  const hasUsage = groups.some((group) => group.bytes > 0);

  return (
    <ChartCard
      title="ESPAÇO DE ANEXOS EM MEGABYTES"
      subtitle={`Total: ${formatMegabytes(totalMegabytes)} em ${totalFiles} arquivo(s)`}
      detailData={detailData}
      detailColumns={detailColumns}
      isDraggable={isDraggable}
    >
      {({ isFullscreen }) => (
        !isLoading && !hasUsage ? (
          <div className="flex items-center justify-center h-full text-content-muted text-sm">
            Nenhum anexo armazenado.
          </div>
        ) : (
          <div className="w-full h-full flex flex-col min-h-0">
            <div className="flex-1 relative min-h-0 p-2">
              <EchartsSurface isFullscreen={isFullscreen} isLoading={isLoading} buildOption={buildOption} />
            </div>
            <div className="shrink-0 px-4 py-2 border-t border-ui-border-soft flex items-baseline justify-between gap-2">
              <span className="text-xs text-content-muted">Total</span>
              <span className="text-sm font-semibold text-content">{formatMegabytes(totalMegabytes)}</span>
            </div>
          </div>
        )
      )}
    </ChartCard>
  );
}
