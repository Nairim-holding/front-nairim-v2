/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import ChartCard from '@/components/dashboard/ChartCard';
import EchartsSurface from '@/components/dashboard/EchartsSurface';
import { authFetch } from '@/utils/authFetch';
import { formatPeriodLabel, getPeriodRange } from '@/utils/periodRange';
import { useTheme } from '@/contexts/ThemeContext';
import { getThemeTokens } from '@/utils';
import { buildCustomTooltipHTML, getCustomEchartsTooltipConfig } from '@/utils/echartsTooltip';

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

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

const formatYears = (years: number) => {
  const n = Number(years) || 0;
  return `${n.toFixed(2).replace('.', ',')} ${n === 1 ? 'ano' : 'anos'}`;
};

/**
 * Distribuição das locações por tempo de permanência do inquilino no imóvel.
 *
 * Unidade de contagem: a LOCAÇÃO — um inquilino com dois imóveis conta duas
 * vezes (e pode aparecer em duas faixas). É o que faz a soma das barras bater
 * exatamente com o número de linhas do "Ver Dados Detalhados".
 *
 * Barras (não pizza): 6 faixas ordenadas formam uma progressão, que o olho lê
 * melhor em barras; e o rótulo de contagem fica visível sem legenda.
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
        const response = await authFetch(
          `${API_URL}/dashboard/tenant-tenure?startDate=${startDate}&endDate=${endDate}`
        );
        if (response.ok) {
          const result = await response.json();
          if (!cancelled) {
            setBuckets(Array.isArray(result.data?.buckets) ? result.data.buckets : []);
            setLeases(Array.isArray(result.data?.leases) ? result.data.leases : []);
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

  const detailColumns = useMemo(
    () => [
      { key: 'tenantName', label: 'Inquilino', width: '200px' },
      { key: 'propertyTitle', label: 'Imóvel', width: '220px' },
      { key: 'contractNumber', label: 'Contrato', width: '120px' },
      { key: 'startDate', label: 'Início', width: '110px', format: (v: string) => formatDateBr(v) },
      { key: 'endDate', label: 'Fim', width: '110px', format: (v: string) => formatDateBr(v) },
      { key: 'situation', label: 'Situação', width: '110px' },
      { key: 'years', label: 'Tempo', width: '110px', format: (v: number) => formatYears(v) },
      { key: 'bucketLabel', label: 'Faixa', width: '170px' },
    ],
    []
  );

  const buildOption = useCallback(
    (isLarge: boolean): EChartsOption => ({
      backgroundColor: 'transparent',
      tooltip: getCustomEchartsTooltipConfig((params: any) => {
        const item = Array.isArray(params) ? params[0] : params;
        const bucket = buckets[item.dataIndex];
        const count = bucket?.count ?? 0;
        const share = total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
        return buildCustomTooltipHTML(bucket?.label ?? item.name ?? '', [
          {
            label: 'Locações',
            value: count,
            color: item.color,
            formattedValue: `${count} (${String(share).replace('.', ',')}%)`,
          },
        ]);
      }),
      grid: {
        top: 36,
        bottom: isLarge ? 60 : 44,
        left: 16,
        right: 16,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: buckets.map((b) => b.shortLabel),
        axisLabel: {
          color: tokens.textMuted,
          fontSize: isLarge ? 12 : 10,
          fontWeight: 500,
          interval: 0,
        },
        axisLine: { lineStyle: { color: tokens.borderSoft } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        show: false,
        // Contagens são inteiras: sem isso o eixo interpola 0,5 locação.
        minInterval: 1,
      },
      series: [
        {
          type: 'bar',
          data: buckets.map((b) => b.count),
          barMaxWidth: isLarge ? 56 : 40,
          itemStyle: {
            borderRadius: [10, 10, 0, 0],
            color: (params: any) => tokens.chartSeries[params.dataIndex % tokens.chartSeries.length],
          },
          label: {
            show: true,
            position: 'top',
            color: tokens.textPrimary,
            fontSize: isLarge ? 12 : 10,
            fontWeight: 'bold',
          },
        },
      ],
    }),
    [buckets, total, tokens]
  );

  return (
    <ChartCard
      title="TEMPO DE PERMANÊNCIA DOS INQUILINOS POR FAIXA"
      subtitle={`${formatPeriodLabel(startDate, endDate)} • ${total} ${total === 1 ? 'locação' : 'locações'}`}
      detailData={detailData}
      detailColumns={detailColumns}
    >
      {({ isFullscreen }) =>
        !isLoading && total === 0 ? (
          <div className="flex items-center justify-center h-full text-content-muted text-sm text-center px-4">
            Nenhuma locação vigente no período selecionado.
          </div>
        ) : (
          <div className="w-full h-full p-2 relative min-h-0">
            <EchartsSurface isFullscreen={isFullscreen} isLoading={isLoading} buildOption={buildOption} />
          </div>
        )
      }
    </ChartCard>
  );
}
