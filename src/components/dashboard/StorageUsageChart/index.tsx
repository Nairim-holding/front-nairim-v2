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

/** Cor conforme a posição do total dentro da própria escala (sem cota contratada aqui). */
function computeGaugeColor(totalMegabytes: number): string {
  const usageRatio = totalMegabytes / computeMaxMegabytes(totalMegabytes);
  if (usageRatio > 0.8) return '#EF4444';
  if (usageRatio > 0.6) return '#F59E0B';
  return '#10B981';
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
    // Escala do arco em cima do total ocupado (não do maior grupo isolado) —
    // senão o ponteiro (que é o total) sempre estoura o próprio máximo.
    const maxMegabytes = computeMaxMegabytes(totalMegabytes);
    const gaugeColor = computeGaugeColor(totalMegabytes);

    return {
      backgroundColor: 'transparent',
      animationDurationUpdate: 1000,
      animationEasingUpdate: 'cubicOut',
      series: [
        {
          type: 'gauge',
          min: 0,
          max: maxMegabytes,
          startAngle: 225,
          endAngle: -45,
          radius: isLarge ? 130 : '58%',
          center: ['50%', '48%'],

          // Fundo em arco neutro — a cor de destaque fica só no progress/ponteiro,
          // que já reflete o nível de uso. Um arco tricolor fixo aqui competia
          // visualmente com o preenchimento e sugeria uma cota que não existe.
          axisLine: {
            lineStyle: {
              width: isLarge ? 24 : 13,
              color: [[1, tokens.borderSoft]],
            },
          },

          // Preenchimento da barra com gradiente
          progress: {
            show: true,
            width: isLarge ? 24 : 13,
            itemStyle: {
              color: gaugeColor,
              opacity: 0.95,
              shadowColor: gaugeColor,
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowOffsetY: isLarge ? 8 : 6,
            },
          },

          // Ponteiro elegante
          pointer: {
            itemStyle: {
              color: gaugeColor,
              shadowColor: gaugeColor,
              shadowBlur: 8,
            },
            width: isLarge ? 6 : 3,
            length: '60%',
          },

          // Âncora no centro
          anchor: {
            show: true,
            showAbove: true,
            size: isLarge ? 18 : 9,
            itemStyle: {
              color: gaugeColor,
              borderColor: tokens.bgSurface,
              borderWidth: isLarge ? 4 : 3,
              shadowColor: gaugeColor,
              shadowBlur: 10,
            },
          },

          // Marcações de escala (Tarefa 1.5 do guia de correções): mesmo padrão
          // visual do DatabaseUsageChart — mesmo sem cota contratada aqui, os
          // valores ao redor do arco (0 até o teto calculado) dão uma
          // referência de grandeza para o valor central, em vez de um arco "mudo".
          axisTick: {
            distance: isLarge ? -22 : -11,
            length: isLarge ? 6 : 3,
            lineStyle: { color: tokens.textMuted, width: 1 },
          },
          splitLine: {
            distance: isLarge ? -22 : -11,
            length: isLarge ? 12 : 6,
            lineStyle: { color: tokens.textMuted, width: 2 },
          },
          axisLabel: {
            distance: isLarge ? 20 : 10,
            color: tokens.textMuted,
            fontSize: isLarge ? 10 : 7,
            formatter: (value: number) => formatMegabytes(value).replace(',00', ''),
          },

          // Valor central e rótulo NÃO são desenhados pelo ECharts: são HTML
          // sobreposto fora do canvas (ver JSX abaixo), pelo mesmo motivo do
          // DatabaseUsageChart — offsetCenter é percentual do raio do arco, e
          // com um arco fino não dá pra escapar do traçado sem estourar o
          // card. HTML dá posição e contraste diretos.
          detail: { show: false },
          title: { show: false },

          data: [{
            value: totalMegabytes,
            name: 'Espaço utilizado',
          }],
        },
      ],
    };
  }, [totalMegabytes, tokens]);

  const hasUsage = groups.some((group) => group.bytes > 0);
  const gaugeColor = computeGaugeColor(totalMegabytes);

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
            <div className="flex-1 min-h-[110px] relative p-2">
              <EchartsSurface isFullscreen={isFullscreen} isLoading={isLoading} buildOption={buildOption} />
            </div>
            {/* Valor central FORA do canvas do ECharts, num bloco próprio com
                altura reservada por flexbox (shrink-0) — não por porcentagem
                estimada do raio do gauge. Isso garante que o número nunca
                fica sobre o arco, seja qual for o tamanho do card. O arco em
                si (radius) fica bem menor que o container para sobrar
                respiro real entre o traçado e este bloco. */}
            <div className="shrink-0 flex flex-col items-center gap-0.5 px-2 pb-2 pt-1">
              <span
                className="font-bold leading-tight text-center"
                style={{ color: gaugeColor, fontSize: isFullscreen ? 26 : 18 }}
              >
                {formatMegabytes(totalMegabytes)}
              </span>
              <span className="text-content-muted text-center font-medium" style={{ fontSize: isFullscreen ? 13 : 11 }}>
                Espaço utilizado
              </span>
            </div>
            {sortedGroups.length > 0 && (
              <div className="shrink-0 border-t border-ui-border-soft">
                <div
                  className="px-3 py-1.5 grid auto-rows-min gap-1.5"
                  style={{ gridTemplateColumns: `repeat(${isFullscreen ? 4 : 2}, minmax(0, 1fr))` }}
                >
                  {sortedGroups.map((group, index) => {
                    const percentage = totalMegabytes > 0 ? Math.round((group.megabytes / totalMegabytes) * 100) : 0;
                    const color = tokens.chartSeries[index % tokens.chartSeries.length];
                    return (
                      <div key={group.key} className="flex items-center gap-1.5 min-w-0 py-0.5">
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}60` }}
                        />
                        <div className="min-w-0 leading-tight">
                          <div className="text-[11px] text-content-muted truncate">{group.label}</div>
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
