'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import ChartCard from '@/components/dashboard/ChartCard';
import EchartsSurface from '@/components/dashboard/EchartsSurface';
import { getStorageUsageAction } from '@/server/actions/dashboard-usage';
import { useTheme } from '@/contexts/ThemeContext';
import { getThemeTokens } from '@/utils';
import { buildCustomTooltipHTML, getCustomEchartsTooltipConfig } from '@/utils/echartsTooltip';

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
    // Arredonda para a próxima "dezena" acima para sobrar folga visual.
    const rawMax = Math.max(totalMegabytes, 1);
    const magnitude = 10 ** Math.floor(Math.log10(rawMax));
    const maxMegabytes = Math.ceil((rawMax * 1.25) / magnitude) * magnitude;

    // Cor conforme a posição do total dentro da própria escala (não há cota
    // contratada aqui — é só uma indicação visual de "quanto do arco" está ocupado).
    const usageRatio = totalMegabytes / maxMegabytes;
    let gaugeColor = '#10B981'; // Verde
    if (usageRatio > 0.8) gaugeColor = '#EF4444';
    else if (usageRatio > 0.6) gaugeColor = '#F59E0B';

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
          // Raio em pixels (não %) na tela ampliada: um container muito maior
          // com raio percentual deixa o arco enorme e empurra o texto central
          // (offsetCenter também é relativo ao raio) para fora do arco. Reduzido
          // frente ao valor anterior para abrir espaço às marcações de escala
          // (axisLabel) que agora ficam ao redor do arco.
          radius: isLarge ? 150 : '82%',
          center: ['50%', '58%'],

          // Fundo em arco neutro — a cor de destaque fica só no progress/ponteiro,
          // que já reflete o nível de uso. Um arco tricolor fixo aqui competia
          // visualmente com o preenchimento e sugeria uma cota que não existe.
          axisLine: {
            lineStyle: {
              width: isLarge ? 32 : 24,
              color: [[1, tokens.borderSoft]],
            },
          },

          // Preenchimento da barra com gradiente
          progress: {
            show: true,
            width: isLarge ? 32 : 24,
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
            width: isLarge ? 7 : 5,
            length: '70%',
          },

          // Âncora no centro
          anchor: {
            show: true,
            showAbove: true,
            size: isLarge ? 24 : 18,
            itemStyle: {
              color: gaugeColor,
              borderColor: tokens.bgSurface,
              borderWidth: isLarge ? 5 : 4,
              shadowColor: gaugeColor,
              shadowBlur: 12,
            },
          },

          // Marcações de escala (Tarefa 1.5 do guia de correções): mesmo padrão
          // visual do DatabaseUsageChart — mesmo sem cota contratada aqui, os
          // valores ao redor do arco (0 até o teto calculado) dão uma
          // referência de grandeza para o valor central, em vez de um arco "mudo".
          axisTick: {
            distance: isLarge ? -26 : -18,
            length: isLarge ? 7 : 5,
            lineStyle: { color: tokens.textMuted, width: 1 },
          },
          splitLine: {
            distance: isLarge ? -26 : -18,
            length: isLarge ? 14 : 10,
            lineStyle: { color: tokens.textMuted, width: 2 },
          },
          axisLabel: {
            distance: isLarge ? 30 : 22,
            color: tokens.textMuted,
            fontSize: isLarge ? 11 : 9,
            formatter: (value: number) => formatMegabytes(value).replace(',00', ''),
          },

          // Valor central grande, com a unidade já embutida (evita repetir "MB"
          // duas vezes perto de números pequenos como "0,00 MB / 22,83 MB").
          // offsetCenter em % é relativo ao raio do gauge — com raio fixo em
          // pixels na tela ampliada, o mesmo percentual já mantém o texto
          // dentro do arco em vez de vazar para fora dele.
          detail: {
            valueAnimation: true,
            offsetCenter: [0, '18%'],
            color: gaugeColor,
            fontSize: isLarge ? 30 : 24,
            fontWeight: 'bold',
            formatter: () => formatMegabytes(totalMegabytes),
          },

          // Rótulo descritivo abaixo do valor, no lugar do "%" pouco intuitivo.
          title: {
            offsetCenter: [0, '34%'],
            color: tokens.textMuted,
            fontSize: isLarge ? 13 : 11,
            fontWeight: 500,
          },

          data: [{
            value: totalMegabytes,
            name: 'Espaço utilizado',
          }],
        },
      ],
    };
  }, [totalMegabytes, tokens]);

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
            <div className="flex-[2] relative min-h-0 p-2">
              <EchartsSurface isFullscreen={isFullscreen} isLoading={isLoading} buildOption={buildOption} />
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
