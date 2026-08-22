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
  const remainingMb = Math.max(0, quotaMb - usedMb);

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

  const buildOption = useCallback((isLarge: boolean): EChartsOption => {
    const maxScale = quotaMb > 0 ? quotaMb : 1;
    const splitNumber = getSmartSplitNumber(maxScale);

    return {
      backgroundColor: 'transparent',
      animationDurationUpdate: 1000,
      animationEasingUpdate: 'cubicOut',
      series: [
        {
          type: 'gauge',
          min: 0,
          max: maxScale,
          splitNumber,
          startAngle: 220,
          endAngle: -40,
          radius: isLarge ? '76%' : '88%',
          center: ['50%', isLarge ? '48%' : '56%'],

          // Faixas de alerta: verde até 60%, âmbar de 60% a 80%, vermelho de 80% a 100% da cota.
          axisLine: {
            lineStyle: {
              width: isLarge ? 22 : 14,
              color: [
                [SAFE_PERCENT / 100, COLOR_OK],
                [WARNING_PERCENT / 100, COLOR_WARNING],
                [1, COLOR_CRITICAL],
              ],
            },
          },

          // Preenchimento da barra com cor e brilho suave
          progress: {
            show: true,
            width: isLarge ? 22 : 14,
            itemStyle: {
              color: gaugeColor,
              shadowColor: gaugeColor,
              shadowBlur: 10,
            },
          },

          // Ponteiro moderno e visível
          pointer: {
            show: true,
            itemStyle: {
              color: gaugeColor,
              shadowColor: gaugeColor,
              shadowBlur: 6,
            },
            width: isLarge ? 5 : 3.5,
            length: '58%',
          },

          // Âncora central com contraste
          anchor: {
            show: true,
            showAbove: true,
            size: isLarge ? 15 : 10,
            itemStyle: {
              color: gaugeColor,
              borderColor: tokens.bgSurface,
              borderWidth: 3,
              shadowColor: gaugeColor,
              shadowBlur: 8,
            },
          },

          // Subdivisões do arco (ticks intermediários)
          axisTick: {
            show: true,
            splitNumber: 2,
            distance: isLarge ? 4 : 2,
            length: isLarge ? 5 : 3,
            lineStyle: { color: tokens.textMuted, width: 1 },
          },

          // Divisões principais da escala
          splitLine: {
            show: true,
            distance: isLarge ? 4 : 2,
            length: isLarge ? 8 : 5,
            lineStyle: { color: tokens.textSecondary, width: 2 },
          },

          // Números de escala com "MB" em cada marcação
          axisLabel: {
            show: true,
            distance: isLarge ? 22 : 14,
            color: tokens.textPrimary,
            fontSize: isLarge ? 12 : 10,
            fontWeight: 600,
            formatter: (value: number) => formatGaugeTick(value),
          },

          detail: { show: false },
          title: { show: false },
          data: [{ value: usedMb, name: `${formatMb(percent)}% da cota` }],
        },
      ],
    };
  }, [usedMb, quotaMb, percent, gaugeColor, tokens]);

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
        ) : isFullscreen ? (
          /* ══════════════════════════════════════════════════════════════════
             MODO TELA CHEIA — Layout Executivo Dividido (2 Colunas)
             ══════════════════════════════════════════════════════════════════ */
          <div className="w-full h-full flex flex-col justify-center py-2">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Coluna Esquerda: Medidor Hero + Valor Central */}
              <div className="lg:col-span-6 flex flex-col items-center justify-center p-6 rounded-2xl bg-surface-subtle/30 border border-ui-border-soft">
                <div className="w-full h-[280px] sm:h-[320px] relative">
                  <EchartsSurface isFullscreen={isFullscreen} isLoading={isLoading} buildOption={buildOption} />
                </div>
                <div className="flex flex-col items-center gap-1 -mt-4 text-center">
                  <span
                    className="text-3xl sm:text-4xl font-extrabold tracking-tight"
                    style={{ color: gaugeColor }}
                  >
                    {formatMb(usedMb)} / {formatMb(quotaMb)} MB
                  </span>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-subtle border border-ui-border-soft text-xs font-medium text-content-muted">
                    <span>{formatMb(percent)}% da cota contratada</span>
                    <span>•</span>
                    <span
                      className="font-bold"
                      style={{ color: overQuota ? COLOR_CRITICAL : nearQuota ? COLOR_WARNING : COLOR_OK }}
                    >
                      {overQuota ? 'Excedido' : nearQuota ? 'Atenção' : 'Saudável'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Coluna Direita: Painel Diagnóstico e Métricas de Capacidade */}
              <div className="lg:col-span-6 flex flex-col gap-3.5">
                <div className="mb-1">
                  <h4 className="text-base font-bold text-content">Diagnóstico de Capacidade</h4>
                  <p className="text-xs text-content-muted">Resumo de consumo e disponibilidade do banco de dados</p>
                </div>

                <div className="space-y-3">
                  {/* Card Consumo */}
                  <div className="p-4 rounded-xl bg-surface-subtle/50 border border-ui-border-soft flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-content-muted uppercase tracking-wider">Espaço Ocupado</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-brand/10 text-brand">
                        {formatMb(percent)}%
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xl font-bold text-content">{formatMb(usedMb)} MB</span>
                      <span className="text-xs text-content-muted">de {formatMb(quotaMb)} MB contratados</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-ui-border-soft overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, percent)}%`, backgroundColor: gaugeColor }}
                      />
                    </div>
                  </div>

                  {/* Card Disponível */}
                  <div className="p-4 rounded-xl bg-surface-subtle/50 border border-ui-border-soft flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-content-muted uppercase tracking-wider">Espaço Livre</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-success/10 text-success">
                        {formatMb(Math.max(0, 100 - percent))}% livre
                      </span>
                    </div>
                    <span className="text-xl font-bold text-success">{formatMb(remainingMb)} MB</span>
                    <p className="text-xs text-content-muted">Disponível para novos registros e tabelas</p>
                  </div>

                  {/* Card Status / Alerta */}
                  <div
                    className="p-4 rounded-xl border flex items-center justify-between"
                    style={{
                      backgroundColor: overQuota ? `${COLOR_CRITICAL}10` : nearQuota ? `${COLOR_WARNING}10` : 'rgba(16, 185, 129, 0.05)',
                      borderColor: overQuota ? `${COLOR_CRITICAL}40` : nearQuota ? `${COLOR_WARNING}40` : 'rgba(16, 185, 129, 0.2)',
                    }}
                  >
                    <div>
                      <div className="text-xs font-bold text-content">Status da Cota</div>
                      <div className="text-xs text-content-muted mt-0.5">
                        {overQuota
                          ? 'A cota contratada foi ultrapassada. Solicite upgrade.'
                          : nearQuota
                          ? 'Consumo próximo do limite contratado.'
                          : 'Uso dentro dos parâmetros normais de operação.'}
                      </div>
                    </div>
                    <span
                      className="text-xs font-extrabold px-2.5 py-1 rounded-lg shrink-0"
                      style={{
                        backgroundColor: overQuota ? COLOR_CRITICAL : nearQuota ? COLOR_WARNING : COLOR_OK,
                        color: '#FFFFFF',
                      }}
                    >
                      {overQuota ? 'CRÍTICO' : nearQuota ? 'ATENÇÃO' : 'OK'}
                    </span>
                  </div>
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
              <span
                className="font-bold leading-tight text-center tracking-tight text-xl"
                style={{ color: gaugeColor }}
              >
                {formatMb(usedMb)} / {formatMb(quotaMb)} MB
              </span>
              <span className="text-content-muted text-center font-medium text-[11px]">
                {formatMb(percent)}% da cota contratada
              </span>
            </div>

            {(overQuota || nearQuota) && (
              <div
                className="shrink-0 px-4 py-2 text-xs font-semibold border-t border-ui-border-soft text-center"
                style={{ color: overQuota ? COLOR_CRITICAL : COLOR_WARNING }}
              >
                {overQuota
                  ? '⚠️ Limite contratado excedido.'
                  : `⚠️ Consumo em ${formatMb(percent)}% do limite contratado.`}
              </div>
            )}
          </div>
        )
      )}
    </ChartCard>
  );
}
