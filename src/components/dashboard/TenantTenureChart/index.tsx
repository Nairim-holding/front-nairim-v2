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

/**
 * Distribuição das locações por tempo de permanência do inquilino no imóvel
 * ("Tempo de Locação" — Tarefa 1.3 do guia de correções).
 *
 * Unidade de contagem: a LOCAÇÃO — um inquilino com dois imóveis conta duas
 * vezes (e pode aparecer em duas faixas). É o que faz a soma das fatias bater
 * exatamente com o número de linhas do "Ver Dados Detalhados".
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
      legend: {
        show: true,
        type: 'scroll',
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        itemWidth: isLarge ? 14 : 10,
        itemHeight: isLarge ? 14 : 10,
        textStyle: { color: tokens.textSecondary, fontSize: isLarge ? 12 : 10 },
      },
      series: [
        {
          type: 'pie',
          radius: isLarge ? ['40%', '65%'] : ['45%', '68%'],
          center: ['50%', '44%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: isLarge ? 8 : 4,
            borderColor: tokens.bgSurface,
            borderWidth: 2,
          },
          label: {
            show: isLarge,
            position: 'outside',
            formatter: '{b}: {d}%',
            color: tokens.textSecondary,
            fontSize: isLarge ? 12 : 10,
          },
          emphasis: {
            label: { show: true, fontSize: isLarge ? 16 : 12, fontWeight: 'bold' },
            itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: tokens.overlay },
          },
          data: buckets.map((b, index) => ({
            name: b.shortLabel,
            value: b.count,
            itemStyle: { color: tokens.chartSeries[index % tokens.chartSeries.length] },
          })),
        },
      ],
    }),
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
        ) : (
          <div className="w-full h-full p-2 relative min-h-0">
            <EchartsSurface isFullscreen={isFullscreen} isLoading={isLoading} buildOption={buildOption} />
          </div>
        )
      }
    </ChartCard>
  );
}
