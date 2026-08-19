'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import ChartCard from '@/components/dashboard/ChartCard';
import EchartsSurface from '@/components/dashboard/EchartsSurface';
import { getDatabaseUsageAction } from '@/server/actions/dashboard-usage';
import { useTheme } from '@/contexts/ThemeContext';
import { getThemeTokens } from '@/utils';

const SAFE_PERCENT = 60;
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
        const result = await getDatabaseUsageAction();
        if (result.ok) {
          if (!cancelled) {
            setCurrent(result.data.current ?? null);
            setCompanies(Array.isArray(result.data.companies) ? result.data.companies : []);
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
      { key: 'usedMb', label: 'Usado (Megabytes)', format: (v: number) => formatMb(v), summable: true },
      { key: 'quotaMb', label: 'Contratado (Megabytes)', format: (v: number) => formatMb(v), summable: true },
      { key: 'percent', label: '% de uso', format: (v: number) => `${formatMb(v)}%` },
    ],
    []
  );

  // Valor central e rótulo NÃO são desenhados pelo ECharts (detail/title):
  // são HTML sobreposto fora do canvas (ver abaixo), porque offsetCenter é
  // percentual do raio do arco — com um arco fino, qualquer deslocamento
  // grande o suficiente para escapar do traçado colorido também estourava a
  // área do card. HTML dá controle direto de posição e contraste (fundo
  // sólido atrás do texto), sem depender dessa matemática do gauge.
  const buildOption = useCallback((isLarge: boolean): EChartsOption => ({
    backgroundColor: 'transparent',
    animationDurationUpdate: 1000,
    animationEasingUpdate: 'cubicOut',
    series: [
      {
        type: 'gauge',
        min: 0,
        // Cota 0 quebraria a escala do gauge; 1 mantém o arco desenhável.
        max: quotaMb > 0 ? quotaMb : 1,
        startAngle: 210,
        endAngle: -30,
        radius: isLarge ? '82%' : '58%',
        center: ['50%', '48%'],
        // Faixas de alerta: verde até 60%, âmbar de 60% a 80%, vermelho de 80% a 100% da cota.
        axisLine: {
          lineStyle: {
            width: isLarge ? 22 : 12,
            color: [
              [SAFE_PERCENT / 100, COLOR_OK],
              [WARNING_PERCENT / 100, COLOR_WARNING],
              [1, COLOR_CRITICAL],
            ],
          },
        },
        progress: {
          show: true,
          width: isLarge ? 22 : 12,
          itemStyle: { color: gaugeColor },
        },
        pointer: {
          itemStyle: { color: gaugeColor },
          width: isLarge ? 5 : 3,
          length: '55%',
        },
        anchor: {
          show: true,
          showAbove: true,
          size: isLarge ? 18 : 9,
          itemStyle: { color: gaugeColor, borderColor: tokens.bgSurface, borderWidth: 3 },
        },
        axisTick: {
          distance: isLarge ? -22 : -10,
          length: isLarge ? 6 : 3,
          lineStyle: { color: tokens.textMuted, width: 1 },
        },
        splitLine: {
          distance: isLarge ? -22 : -10,
          length: isLarge ? 12 : 6,
          lineStyle: { color: tokens.textMuted, width: 2 },
        },
        axisLabel: {
          distance: isLarge ? 22 : 10,
          color: tokens.textMuted,
          fontSize: isLarge ? 11 : 7,
          formatter: (value: number) => formatMb(value).replace(',00', ''),
        },
        detail: { show: false },
        title: { show: false },
        data: [{ value: usedMb, name: `${formatMb(percent)}% da cota` }],
      },
    ],
  }), [usedMb, quotaMb, percent, gaugeColor, tokens]);

  const overQuota = percent >= CRITICAL_PERCENT;
  const nearQuota = percent >= WARNING_PERCENT && !overQuota;

  return (
    <ChartCard
      title="CONSUMO DE BANCO DE DADOS EM MEGABYTES"
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
            <div className="flex-1 min-h-[110px] relative">
              <EchartsSurface isFullscreen={isFullscreen} isLoading={isLoading} buildOption={buildOption} />
            </div>
            {/* Valor central FORA do canvas do ECharts, num bloco próprio com
                altura reservada por flexbox (shrink-0) — não em overlay
                posicionado por porcentagem do raio do gauge (offsetCenter é
                relativo ao raio, e um arco fino faz o texto ficar preso perto
                do traçado colorido em vez de realmente "fora" dele). O arco
                em si (radius) fica bem menor que o container para sobrar
                respiro real entre o traçado e este bloco. */}
            <div className="shrink-0 flex flex-col items-center gap-0.5 px-2 pb-2 pt-1">
              <span
                className="font-bold leading-tight text-center"
                style={{ color: gaugeColor, fontSize: isFullscreen ? 24 : 18 }}
              >
                {formatMb(usedMb)} / {formatMb(quotaMb)} MB
              </span>
              <span className="text-content-muted text-center" style={{ fontSize: isFullscreen ? 12 : 11 }}>
                {formatMb(percent)}% da cota
              </span>
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
