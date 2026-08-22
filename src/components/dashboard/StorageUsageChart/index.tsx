'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import ChartCard from '@/components/dashboard/ChartCard';
import EchartsSurface from '@/components/dashboard/EchartsSurface';
import { getStorageUsageAction } from '@/server/actions/dashboard-usage';
import { useTheme } from '@/contexts/ThemeContext';
import { getThemeTokens } from '@/utils';

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

/** Teto do arco: próxima "dezena" acima de 1,25x o total, para sobrar folga visual. */
function computeMaxMegabytes(totalMegabytes: number): number {
  const rawMax = Math.max(totalMegabytes, 1);
  const magnitude = 10 ** Math.floor(Math.log10(rawMax));
  return Math.ceil((rawMax * 1.25) / magnitude) * magnitude;
}

/** Define 4 intervalos ideais (0%, 25%, 50%, 75%, 100%) para haver um único valor no ápice e amplo espaçamento. */
function getSmartSplitNumber(_max: number): number {
  return 4;
}

/** Formata todos os valores da escala com MB no final de forma nítida. */
function formatGaugeTick(value: number): string {
  const isInteger = Number.isInteger(value) || Math.abs(value - Math.round(value)) < 0.001;
  const formatted = value.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: isInteger ? 0 : 1,
  });
  return `${formatted} MB`;
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
        const result = await getStorageUsageAction();
        if (result.ok) {
          if (!cancelled) {
            setGroups(Array.isArray(result.data.groups) ? result.data.groups : []);
            setTotalMegabytes(Number(result.data.totalMegabytes ?? 0));
            setTotalFiles(Number(result.data.totalFiles ?? 0));
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
      { key: 'megabytes', label: 'Tamanho (MB)', format: (v: number) => formatMegabytes(v), summable: true },
      { key: 'files', label: 'Qtde de arquivos', summable: true },
    ],
    []
  );

  const buildOption = useCallback((isLarge: boolean): EChartsOption => {
    const maxMegabytes = computeMaxMegabytes(totalMegabytes);
    const splitNumber = getSmartSplitNumber(maxMegabytes);

    // Constrói o arco multicolorido dividido proporcionalmente pelo consumo de cada categoria
    const colorSegments: [number, string][] = [];
    let cumulative = 0;
    const activeGroups = sortedGroups.filter((g) => g.megabytes > 0);

    if (activeGroups.length > 0 && maxMegabytes > 0) {
      activeGroups.forEach((group) => {
        const originalIndex = sortedGroups.findIndex((g) => g.key === group.key);
        const groupColor = tokens.chartSeries[originalIndex % tokens.chartSeries.length];
        cumulative += group.megabytes;
        const ratio = Math.min(cumulative / maxMegabytes, 1);
        colorSegments.push([ratio, groupColor]);
      });
      if (cumulative < maxMegabytes) {
        colorSegments.push([1, tokens.borderSoft]);
      }
    } else {
      colorSegments.push([1, tokens.borderSoft]);
    }

    return {
      backgroundColor: 'transparent',
      animationDurationUpdate: 1000,
      animationEasingUpdate: 'cubicOut',
      tooltip: {
        show: true,
        formatter: () => {
          const lines = sortedGroups
            .filter((g) => g.megabytes > 0)
            .map((g, i) => {
              const color = tokens.chartSeries[i % tokens.chartSeries.length];
              const pct = totalMegabytes > 0 ? ((g.megabytes / totalMegabytes) * 100).toFixed(1) : '0';
              return `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:4px;">
                <span style="display:inline-flex;align-items:center;gap:6px;">
                  <span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;"></span>
                  <span>${g.label}</span>
                </span>
                <span style="font-weight:600;">${formatMegabytes(g.megabytes)} (${pct}%)</span>
              </div>`;
            })
            .join('');

          return `<div style="padding:4px 2px;">
            <div style="font-weight:bold;margin-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.15);padding-bottom:4px;">
              Consumo Total: ${formatMegabytes(totalMegabytes)}
            </div>
            ${lines}
          </div>`;
        },
      },
      series: [
        {
          type: 'gauge',
          min: 0,
          max: maxMegabytes,
          splitNumber,
          startAngle: 220,
          endAngle: -40,
          radius: isLarge ? '86%' : '88%',
          center: ['50%', '56%'],

          // Arco segmentado com as cores exatas de cada categoria
          axisLine: {
            lineStyle: {
              width: isLarge ? 22 : 14,
              color: colorSegments,
            },
          },

          // O progresso não é necessário pois o próprio axisLine já exibe as cores das categorias
          progress: {
            show: false,
          },

          // Ponteiro elegante e com alto contraste
          pointer: {
            show: true,
            itemStyle: {
              color: '#FFFFFF',
              shadowColor: 'rgba(0, 0, 0, 0.6)',
              shadowBlur: 6,
            },
            width: isLarge ? 5 : 3.5,
            length: '58%',
          },

          // Âncora central com contraste
          anchor: {
            show: true,
            showAbove: true,
            size: isLarge ? 16 : 10,
            itemStyle: {
              color: '#FFFFFF',
              borderColor: tokens.bgSurface,
              borderWidth: 3,
              shadowColor: 'rgba(0, 0, 0, 0.4)',
              shadowBlur: 8,
            },
          },

          // Subdivisões do arco (ticks intermediários)
          axisTick: {
            show: true,
            splitNumber: 2,
            distance: isLarge ? 4 : 2,
            length: isLarge ? 6 : 3,
            lineStyle: { color: tokens.textMuted, width: 1 },
          },

          // Divisões principais da escala
          splitLine: {
            show: true,
            distance: isLarge ? 4 : 2,
            length: isLarge ? 9 : 5,
            lineStyle: { color: tokens.textSecondary, width: 2 },
          },

          // Números de escala com "MB" em cada marcação
          axisLabel: {
            show: true,
            distance: isLarge ? 24 : 14,
            color: tokens.textPrimary,
            fontSize: isLarge ? 13 : 10,
            fontWeight: 600,
            formatter: (value: number) => formatGaugeTick(value),
          },

          detail: { show: false },
          title: { show: false },

          data: [{
            value: totalMegabytes,
            name: 'Espaço utilizado',
          }],
        },
      ],
    };
  }, [totalMegabytes, sortedGroups, tokens]);

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
        ) : isFullscreen ? (
          /* ══════════════════════════════════════════════════════════════════
             MODO TELA CHEIA — Layout Executivo Dividido (2 Colunas)
             ══════════════════════════════════════════════════════════════════ */
          <div className="w-full h-full flex flex-col justify-center py-2">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Coluna Esquerda: Medidor Hero + KPI Principal */}
              <div className="lg:col-span-6 flex flex-col items-center justify-center p-6 rounded-2xl bg-surface-subtle/30 border border-ui-border-soft">
                <div className="w-full h-[280px] sm:h-[320px] relative">
                  <EchartsSurface isFullscreen={isFullscreen} isLoading={isLoading} buildOption={buildOption} />
                </div>
                <div className="flex flex-col items-center gap-1 -mt-4 text-center">
                  <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-content">
                    {formatMegabytes(totalMegabytes)}
                  </span>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-subtle border border-ui-border-soft text-xs font-medium text-content-muted">
                    <span>Espaço Total Utilizado</span>
                    <span>•</span>
                    <span className="text-content font-semibold">{totalFiles} arquivos</span>
                  </div>
                </div>
              </div>

              {/* Coluna Direita: Detalhamento por Categoria com Barras de Progresso */}
              <div className="lg:col-span-6 flex flex-col gap-3">
                <div className="mb-1">
                  <h4 className="text-base font-bold text-content">Detalhamento por Categoria</h4>
                  <p className="text-xs text-content-muted">Distribuição percentual do consumo de armazenamento</p>
                </div>

                <div className="space-y-2.5">
                  {sortedGroups.map((group, index) => {
                    const percentage = totalMegabytes > 0 ? Math.round((group.megabytes / totalMegabytes) * 100) : 0;
                    const color = tokens.chartSeries[index % tokens.chartSeries.length];
                    return (
                      <div
                        key={group.key}
                        className="p-3.5 rounded-xl bg-surface-subtle/50 border border-ui-border-soft flex flex-col gap-2 hover:border-ui-border-strong hover:bg-surface-subtle/80 transition-all"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                              style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}80` }}
                            />
                            <span className="text-sm font-semibold text-content truncate">{group.label}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-sm font-bold text-content">{formatMegabytes(group.megabytes)}</span>
                            <span
                              className="text-xs font-semibold px-2 py-0.5 rounded-md"
                              style={{ backgroundColor: `${color}20`, color }}
                            >
                              {percentage}%
                            </span>
                          </div>
                        </div>

                        {/* Barra de progresso proporcional */}
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 rounded-full bg-ui-border-soft overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%`, backgroundColor: color }}
                            />
                          </div>
                          <span className="text-[11px] text-content-muted shrink-0 font-medium">{group.files} arq.</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ══════════════════════════════════════════════════════════════════
             MODO COMPACTO PADRÃO (Card da Dashboard)
             ══════════════════════════════════════════════════════════════════ */
          <div className="w-full h-full flex flex-col justify-between min-h-0">
            <div className="flex-1 min-h-[140px] relative">
              <EchartsSurface isFullscreen={isFullscreen} isLoading={isLoading} buildOption={buildOption} />
            </div>

            {/* Valor central */}
            <div className="shrink-0 flex flex-col items-center gap-0.5 px-2 pb-2 pt-0.5">
              <span className="font-bold leading-tight text-center tracking-tight text-content text-xl">
                {formatMegabytes(totalMegabytes)}
              </span>
              <span className="text-content-muted text-center font-medium text-[11px]">
                Espaço total utilizado em {totalFiles} arquivo(s)
              </span>
            </div>

            {sortedGroups.length > 0 && (
              <div className="shrink-0 border-t border-ui-border-soft">
                <div
                  className="px-3 py-2 grid auto-rows-min gap-1.5"
                  style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
                >
                  {sortedGroups.map((group, index) => {
                    const percentage = totalMegabytes > 0 ? Math.round((group.megabytes / totalMegabytes) * 100) : 0;
                    const color = tokens.chartSeries[index % tokens.chartSeries.length];
                    return (
                      <div key={group.key} className="flex items-center gap-1.5 min-w-0 py-0.5">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}60` }}
                        />
                        <div className="min-w-0 leading-tight">
                          <div className="text-[11px] text-content-muted truncate font-medium">{group.label}</div>
                          <div className="text-xs font-semibold text-content truncate">
                            {formatMegabytes(group.megabytes)} <span className="text-content-muted font-normal">· {percentage}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )
      )}
    </ChartCard>
  );
}
