/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import ChartCard from '@/components/dashboard/ChartCard';
import EchartsSurface from '@/components/dashboard/EchartsSurface';
import { getTenantTenureDistributionAction } from '@/server/actions/dashboard-usage';
import { formatPeriodLabel, getPeriodRange } from '@/utils/periodRange';
import { useTheme } from '@/contexts/ThemeContext';
import { getThemeTokens } from '@/utils';
import { buildCustomTooltipHTML, getCustomEchartsTooltipConfig } from '@/utils/echartsTooltip';

interface TenureBucket {
  key: string;
  label: string;
  shortLabel: string;
  count: number;
}

interface TenureLease {
  id: string;
  tenantName: string;
  propertyTitle: string;
  contractNumber: string;
  startDate: string;
  endDate: string;
  situation: string;
  years: number;
  bucketKey: string;
  bucketLabel: string;
}

interface TenantTenureChartProps {
  startDate?: string;
  endDate?: string;
}

const formatDateBr = (iso: string) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

/** Formata rótulo do bucket em caixa alta para a legenda de barras (estilo referência) */
function formatBucketDisplayLabel(label: string): string {
  return label
    .toUpperCase()
    .replace(/^DE\s+/, '')
    .replace(/\s+ATÉ\s+/, ' A ');
}

/**
 * Distribuição das locações por tempo de permanência do inquilino no imóvel
 * ("Tempo de Locação" — Tarefa 1.3 do guia de correções).
 *
 * Exibe gráfico de rosca com porcentagens e detalhamento de barras horizontais
 * com a quantidade de inquilinos/locações por faixa de anos (referência de design).
 */
export default function TenantTenureChart({ startDate: startDateProp, endDate: endDateProp }: TenantTenureChartProps) {
  useTheme();
  const tokens = getThemeTokens();
  const fallback = useMemo(() => getPeriodRange(new Date().getFullYear(), [new Date().getMonth() + 1]), []);
  const startDate = startDateProp ?? fallback.startDate;
  const endDate = endDateProp ?? fallback.endDate;

  const [buckets, setBuckets] = useState<TenureBucket[]>([]);
  const [leases, setLeases] = useState<TenureLease[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const result = await getTenantTenureDistributionAction(startDate, endDate);
        if (result.ok) {
          if (!cancelled) {
            setBuckets(Array.isArray(result.data.buckets) ? result.data.buckets : []);
            setLeases(Array.isArray(result.data.leases) ? result.data.leases : []);
          }
        }
      } catch (error) {
        console.error('[TenantTenureChart] Erro ao carregar tempo de permanência:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  const total = useMemo(() => buckets.reduce((sum, b) => sum + b.count, 0), [buckets]);
  const maxCount = useMemo(() => Math.max(...buckets.map((b) => b.count), 1), [buckets]);

  // Uma linha por locação — as mesmas linhas que geraram as barras.
  const detailData = useMemo(
    () =>
      leases
        .slice()
        .sort((a, b) => b.years - a.years)
        .map((l) => ({
          tenantName: l.tenantName,
          propertyTitle: l.propertyTitle,
          contractNumber: l.contractNumber,
          startDate: l.startDate,
          endDate: l.endDate,
          situation: l.situation,
          years: l.years,
          bucketLabel: l.bucketLabel,
        })),
    [leases]
  );

  // Faixa vira cabeçalho de grupo no modal de detalhes (abaixo); não repetida como coluna.
  const detailColumns = useMemo(
    () => [
      { key: 'tenantName', label: 'Inquilino', width: '200px' },
      { key: 'propertyTitle', label: 'Imóvel', width: '220px' },
      { key: 'contractNumber', label: 'Contrato', width: '120px' },
      { key: 'startDate', label: 'Início', width: '110px', format: (v: string) => formatDateBr(v) },
      { key: 'endDate', label: 'Fim', width: '110px', format: (v: string) => formatDateBr(v) },
      { key: 'situation', label: 'Situação', width: '110px' },
    ],
    []
  );

  // Mesma ordem das faixas do gráfico (a API já retorna `buckets` nessa ordem).
  const detailGroupBy = useMemo(
    () => ({
      key: 'bucketLabel',
      order: buckets.map((b) => b.label),
      unitLabel: (n: number) => `Total de ${n} ${n === 1 ? 'locação' : 'locações'}`,
    }),
    [buckets]
  );

  const buildOption = useCallback(
    (isLarge: boolean): EChartsOption => {
      const activeBuckets = buckets.filter((b) => b.count > 0 || total === 0);

      return {
        backgroundColor: 'transparent',
        tooltip: getCustomEchartsTooltipConfig((params: any) => {
          const item = Array.isArray(params) ? params[0] : params;
          const bucket =
            buckets.find((b) => b.shortLabel === item.name || b.label === item.name) ??
            activeBuckets[item.dataIndex];
          const count = bucket?.count ?? item.value ?? 0;
          const share = total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
          return buildCustomTooltipHTML(bucket?.label ?? item.name ?? '', [
            {
              label: 'Inquilinos / Locações',
              value: count,
              color: item.color,
              formattedValue: `${count} (${String(share).replace('.', ',')}%)`,
            },
          ]);
        }),
        legend: {
          show: false,
        },
        series: [
          {
            type: 'pie',
            radius: isLarge ? ['48%', '78%'] : ['46%', '76%'],
            center: ['50%', '50%'],
            avoidLabelOverlap: true,
            itemStyle: {
              borderRadius: isLarge ? 6 : 4,
              borderColor: tokens.bgSurface,
              borderWidth: 2,
            },
            label: {
              show: true,
              position: 'outside',
              formatter: (params: any) => {
                const count = params.value ?? 0;
                const pct = params.percent;
                if (pct === undefined || pct <= 0) return '';
                const formattedPct = Number.isInteger(pct) ? `${pct}%` : `${String(pct).replace('.', ',')}%`;
                return `${count} (${formattedPct})`;
              },
              color: tokens.textSecondary,
              fontSize: isLarge ? 14 : 12,
              fontWeight: 700,
            },
            labelLine: {
              show: true,
              length: isLarge ? 10 : 6,
              length2: isLarge ? 8 : 5,
              smooth: 0.1,
            },
            emphasis: {
              label: {
                show: true,
                fontSize: isLarge ? 16 : 14,
                fontWeight: 'bold',
                formatter: (params: any) => {
                  const count = params.value ?? 0;
                  const pct = params.percent ?? 0;
                  return `${count} (${String(pct).replace('.', ',')}%)`;
                },
              },
              itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: tokens.overlay },
            },
            data: activeBuckets.map((b) => {
              const originalIndex = buckets.findIndex((orig) => orig.key === b.key);
              const colorIndex = originalIndex >= 0 ? originalIndex : 0;
              return {
                name: b.shortLabel,
                value: b.count,
                itemStyle: { color: tokens.chartSeries[colorIndex % tokens.chartSeries.length] },
              };
            }),
          },
        ],
      };
    },
    [buckets, total, tokens]
  );

  return (
    <ChartCard
      title="TEMPO DE LOCAÇÃO"
      subtitle={`${formatPeriodLabel(startDate, endDate)} • ${total} ${total === 1 ? 'locação' : 'locações'}`}
      detailData={detailData}
      detailColumns={detailColumns}
      detailGroupBy={detailGroupBy}
      detailTotalLabel="locações"
    >
      {({ isFullscreen }) =>
        !isLoading && total === 0 ? (
          <div className="flex items-center justify-center h-full text-content-muted text-sm text-center px-4">
            Nenhuma locação vigente no período selecionado.
          </div>
        ) : isFullscreen ? (
          /* ══════════════════════════════════════════════════════════════════
             MODO TELA CHEIA — Layout Executivo Dividido (2 Colunas)
             ══════════════════════════════════════════════════════════════════ */
          <div className="w-full h-full flex flex-col justify-center py-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center h-full">
              {/* Coluna Esquerda: Rosca Grande com Porcentagens */}
              <div className="lg:col-span-6 flex flex-col items-center justify-center p-6 rounded-2xl bg-surface-subtle/30 border border-ui-border-soft h-full min-h-[360px]">
                <div className="w-full h-[320px] sm:h-[380px] relative">
                  <EchartsSurface isFullscreen={isFullscreen} isLoading={isLoading} buildOption={buildOption} />
                </div>
                <div className="flex flex-col items-center gap-1 -mt-2 text-center">
                  <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-content">{total}</span>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-subtle border border-ui-border-soft text-xs font-medium text-content-muted">
                    <span>Total de Locações / Inquilinos</span>
                  </div>
                </div>
              </div>

              {/* Coluna Direita: Barras Horizontais com Quantidade de Inquilinos */}
              <div className="lg:col-span-6 flex flex-col justify-center gap-4">
                <div className="mb-2">
                  <h4 className="text-base font-bold text-content">Distribuição por Tempo de Casa</h4>
                  <p className="text-xs text-content-muted">Quantidade de inquilinos e percentual em cada faixa de permanência</p>
                </div>

                <div className="space-y-3.5">
                  {buckets.map((b, index) => {
                    const color = tokens.chartSeries[index % tokens.chartSeries.length];
                    const percentage = total > 0 ? Math.round((b.count / total) * 1000) / 10 : 0;
                    const barWidthPercent = maxCount > 0 ? Math.max((b.count / maxCount) * 100, b.count > 0 ? 10 : 2) : 2;

                    return (
                      <div key={b.key} className="flex items-center gap-3">
                        {/* Barra horizontal colorida proporcional */}
                        <div className="w-[50%] flex items-center justify-end">
                          <div
                            className="h-8 rounded-md flex items-center justify-end px-2.5 transition-all duration-500 shadow-sm"
                            style={{
                              width: `${barWidthPercent}%`,
                              backgroundColor: color,
                              minWidth: b.count > 0 ? '42px' : '8px',
                            }}
                          >
                            {b.count > 0 && (
                              <span className="text-xs font-bold text-white tracking-wide">{b.count}</span>
                            )}
                          </div>
                        </div>

                        {/* Rótulo da faixa em caixa alta + percentual */}
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-xs font-bold text-content tracking-wide">
                            {formatBucketDisplayLabel(b.label)}
                          </span>
                          <span className="text-[11px] font-medium text-content-muted">
                            ({String(percentage).replace('.', ',')}%)
                          </span>
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
             MODO COMPACTO PADRÃO (Card da Dashboard) — Lado a Lado (Rosca Ampla + Barras)
             ══════════════════════════════════════════════════════════════════ */
          <div className="w-full h-full flex flex-col sm:flex-row items-center justify-between min-h-0 px-2 py-1 gap-2">
            {/* Lado Esquerdo: Rosca Grande em destaque */}
            <div className="w-full sm:w-[52%] h-[200px] sm:h-full relative shrink-0">
              <EchartsSurface isFullscreen={isFullscreen} isLoading={isLoading} buildOption={buildOption} />
            </div>

            {/* Lado Direito: Barras horizontais com Quantidade de Inquilinos (Referência da Print) */}
            <div className="w-full sm:w-[48%] flex flex-col justify-center gap-2 py-1 pr-2">
              {buckets.map((b, index) => {
                const color = tokens.chartSeries[index % tokens.chartSeries.length];
                const percentage = total > 0 ? Math.round((b.count / total) * 1000) / 10 : 0;
                const barWidthPercent = maxCount > 0 ? Math.max((b.count / maxCount) * 100, b.count > 0 ? 16 : 3) : 3;

                return (
                  <div key={b.key} className="flex items-center gap-2 min-w-0">
                    {/* Barra horizontal proporcional com valor alinhado */}
                    <div className="w-[45%] flex items-center justify-end">
                      <div
                        className="h-5 rounded flex items-center justify-end px-1.5 transition-all duration-500 shrink-0 shadow-xs"
                        style={{
                          width: `${barWidthPercent}%`,
                          backgroundColor: color,
                          minWidth: b.count > 0 ? '30px' : '6px',
                        }}
                      >
                        {b.count > 0 && (
                          <span className="text-[11px] font-bold text-white leading-none">{b.count}</span>
                        )}
                      </div>
                    </div>

                    {/* Rótulo da faixa + porcentagem sutil */}
                    <div className="flex-1 min-w-0 flex items-center gap-1">
                      <span className="text-[10px] sm:text-[11px] font-bold text-content truncate uppercase tracking-tight">
                        {formatBucketDisplayLabel(b.label)}
                      </span>
                      {b.count > 0 && (
                        <span className="text-[9px] text-content-muted shrink-0 font-medium">
                          ({String(percentage).replace('.', ',')}%)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      }
    </ChartCard>
  );
}
