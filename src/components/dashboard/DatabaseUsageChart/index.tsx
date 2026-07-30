'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import ChartCard from '@/components/dashboard/ChartCard';
import EchartsSurface from '@/components/dashboard/EchartsSurface';
import { authFetch } from '@/utils/authFetch';
import { useTheme } from '@/contexts/ThemeContext';
import { getThemeTokens } from '@/utils';

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

/** Cortes do semáforo de consumo, em % da cota contratada. */
const WARNING_PERCENT = 80;
const CRITICAL_PERCENT = 100;

const COLOR_OK = '#10B981';
const COLOR_WARNING = '#F59E0B';
const COLOR_CRITICAL = '#EF4444';

interface CompanyUsage {
  companyId: string;
  companyName: string;
  usedMb: number;
  quotaMb: number;
  percent: number;
  isCurrent: boolean;
}

/** Número em pt-BR com 2 casas — ex.: 4,06. */
function formatMb(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function colorForPercent(percent: number): string {
  if (percent >= CRITICAL_PERCENT) return COLOR_CRITICAL;
  if (percent >= WARNING_PERCENT) return COLOR_WARNING;
  return COLOR_OK;
}

interface DatabaseUsageChartProps {
  /** Fora do grid arrastável do Financeiro, o cabeçalho não é alça de arraste. */
  isDraggable?: boolean;
}

export default function DatabaseUsageChart({ isDraggable = false }: DatabaseUsageChartProps) {
  useTheme();
  const tokens = getThemeTokens();

  const [current, setCurrent] = useState<CompanyUsage | null>(null);
  const [companies, setCompanies] = useState<CompanyUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const response = await authFetch(`${API_URL}/dashboard/database`);
        if (response.ok) {
          const result = await response.json();
          if (!cancelled) {
            setCurrent(result.data?.current ?? null);
            setCompanies(Array.isArray(result.data?.companies) ? result.data.companies : []);
          }
        }
      } catch (error) {
        console.error('[DatabaseUsageChart] Erro ao carregar consumo de banco de dados:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const usedMb = current?.usedMb ?? 0;
  const quotaMb = current?.quotaMb ?? 0;
  const percent = current?.percent ?? 0;
  const gaugeColor = colorForPercent(percent);

  const detailData = useMemo(
    () =>
      companies.map((company) => ({
        companyName: company.companyName,
        usedMb: company.usedMb,
        quotaMb: company.quotaMb,
        percent: company.percent,
      })),
    [companies]
  );

  const detailColumns = useMemo(
    () => [
      { key: 'companyName', label: 'Empresa' },
      { key: 'usedMb', label: 'Usado (MB)', format: (v: number) => formatMb(v) },
      { key: 'quotaMb', label: 'Contratado (MB)', format: (v: number) => formatMb(v) },
      { key: 'percent', label: '% de uso', format: (v: number) => `${formatMb(v)}%` },
    ],
    []
  );

  const buildOption = useCallback((isLarge: boolean): EChartsOption => ({
    backgroundColor: 'transparent',
    series: [
      {
        type: 'gauge',
        min: 0,
        // Cota 0 quebraria a escala do gauge; 1 mantém o arco desenhável.
        max: quotaMb > 0 ? quotaMb : 1,
        startAngle: 210,
        endAngle: -30,
        radius: isLarge ? '82%' : '92%',
        center: ['50%', '58%'],
        // Faixas de alerta: verde até 80% da cota, âmbar de 80% a 100%.
        axisLine: {
          lineStyle: {
            width: isLarge ? 26 : 18,
            color: [
              [WARNING_PERCENT / 100, COLOR_OK],
              [1, COLOR_WARNING],
            ],
          },
        },
        // Acima da cota o ponteiro satura no fim da escala; o valor real
        // continua legível no texto central, em vermelho.
        progress: { show: false },
        pointer: {
          itemStyle: { color: gaugeColor },
          width: isLarge ? 6 : 4,
          length: '62%',
        },
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
          fontSize: isLarge ? 12 : 10,
          formatter: (value: number) => formatMb(value).replace(',00', ''),
        },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, isLarge ? '38%' : '34%'],
          color: gaugeColor,
          fontSize: isLarge ? 26 : 18,
          fontWeight: 'bold',
          formatter: () => `${formatMb(usedMb)} / ${formatMb(quotaMb)} MB`,
        },
        title: {
          offsetCenter: [0, isLarge ? '64%' : '60%'],
          color: tokens.textMuted,
          fontSize: isLarge ? 14 : 11,
        },
        data: [{ value: usedMb, name: `${formatMb(percent)}% da cota` }],
      },
    ],
  }), [usedMb, quotaMb, percent, gaugeColor, tokens]);

  const overQuota = percent >= CRITICAL_PERCENT;
  const nearQuota = percent >= WARNING_PERCENT && !overQuota;

  return (
    <ChartCard
      title="CONSUMO DE BANCO DE DADOS EM MB"
      subtitle={current ? `${current.companyName} — ${formatMb(usedMb)} de ${formatMb(quotaMb)} MB contratados` : undefined}
      detailData={detailData}
      detailColumns={detailColumns}
      isDraggable={isDraggable}
    >
      {({ isFullscreen }) => (
        !isLoading && !current ? (
          <div className="flex items-center justify-center h-full text-content-muted text-sm">
            Consumo de banco indisponível.
          </div>
        ) : (
          <div className="w-full h-full flex flex-col min-h-0">
            <div className="flex-1 relative min-h-0">
              <EchartsSurface isFullscreen={isFullscreen} isLoading={isLoading} buildOption={buildOption} />
            </div>
            {(overQuota || nearQuota) && (
              <div
                className="shrink-0 px-4 py-2 text-xs font-medium border-t border-ui-border-soft"
                style={{ color: overQuota ? COLOR_CRITICAL : COLOR_WARNING }}
              >
                {overQuota
                  ? 'Limite contratado excedido.'
                  : `Consumo em ${formatMb(percent)}% do limite contratado.`}
              </div>
            )}
          </div>
        )
      )}
    </ChartCard>
  );
}
