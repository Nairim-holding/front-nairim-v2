'use client';

import { useMemo, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import NumericCard from '@/components/charts/MetricCard';
import { MetricResponse, MetricWithData } from '@/types/types';
import { formatCurrencyFixed, formatCurrencyRounded } from '@/utils/displayFormatters';
import {
  COLS_AVG_RENTAL, COLS_TOTAL_RENTAL, COLS_TAX_FEE, COLS_ACQUISITION,
  COLS_FINANCIAL_VACANCY_GAUGE, COLS_VACANCY_MONTHS,
} from '@/lib/columns';

const EChartsGauge = dynamic(() => import('@/components/charts/GaugeChart'), { ssr: false });

/** Mesma classe usada pelo ChartCard: a barra do título é a alça de arrastar. */
const DRAG_HANDLE_CLASS = 'widget-drag-handle';

/**
 * Estes 6 widgets já existiam no financeiro (antes desta etapa, viviam soltos
 * acima do grid). Passam a viver dentro do grid arrastável/redimensionável,
 * mantendo o comportamento próprio de cada um (expandir, ver detalhes). Sem
 * ícone de arrastar flutuante sobre o título (colidia com o texto): seguem o
 * mesmo padrão do ChartCard, onde a própria barra do título é a alça.
 */
function LegacyWidgetWrapper({ children }: { children: ReactNode }) {
  // [&>div]:h-full / min-w-0: NumericCard/EChartsGauge têm altura de conteúdo
  // e min-w-[300px] próprios; dentro de uma célula do grid precisam preencher
  // exatamente a célula (sem sobrar vão embaixo nem estourar a largura da coluna).
  return (
    <div className="h-full [&>div]:h-full [&>div]:min-w-0">
      {children}
    </div>
  );
}

type MetricDataKeys = {
  [K in keyof MetricResponse]: MetricResponse[K] extends MetricWithData ? K : never;
}[keyof MetricResponse];

function useMetricGetter(metrics: MetricResponse | null) {
  return (k: MetricDataKeys): MetricWithData =>
    ((metrics?.[k] as MetricWithData) ?? { result: 0, variation: 0, isPositive: false, data: [] });
}

interface LegacyWidgetProps {
  metrics: MetricResponse | null;
}

export function AvgRentalWidget({ metrics }: LegacyWidgetProps) {
  const get = useMetricGetter(metrics);
  const value = useMemo(() => formatCurrencyFixed(metrics?.averageRentalTicket?.result), [metrics]);
  return (
    <LegacyWidgetWrapper>
      <NumericCard
        value={value}
        label="Ticket Médio do Aluguel"
        variation={String(get('averageRentalTicket').variation)}
        positive={get('averageRentalTicket').isPositive}
        detailData={get('averageRentalTicket').data}
        detailColumns={COLS_AVG_RENTAL}
        dragHandleClassName={DRAG_HANDLE_CLASS}
      />
    </LegacyWidgetWrapper>
  );
}

export function TotalRentalWidget({ metrics }: LegacyWidgetProps) {
  const get = useMetricGetter(metrics);
  const value = useMemo(() => formatCurrencyFixed(metrics?.totalRentalActive?.result), [metrics]);
  return (
    <LegacyWidgetWrapper>
      <NumericCard
        value={value}
        label="Valor Total de Aluguel do Portfólio"
        variation={String(get('totalRentalActive').variation)}
        positive={get('totalRentalActive').isPositive}
        detailData={get('totalRentalActive').data}
        detailColumns={COLS_TOTAL_RENTAL}
        dragHandleClassName={DRAG_HANDLE_CLASS}
      />
    </LegacyWidgetWrapper>
  );
}

export function TaxFeeWidget({ metrics }: LegacyWidgetProps) {
  const get = useMetricGetter(metrics);
  const value = useMemo(() => formatCurrencyRounded(metrics?.totalPropertyTaxAndCondoFee?.result), [metrics]);
  return (
    <LegacyWidgetWrapper>
      <NumericCard
        value={value}
        label="Total de Impostos e Taxas (Mensal Est.)"
        variation={String(get('totalPropertyTaxAndCondoFee').variation)}
        positive={get('totalPropertyTaxAndCondoFee').isPositive}
        detailData={get('totalPropertyTaxAndCondoFee').data}
        detailColumns={COLS_TAX_FEE}
        dragHandleClassName={DRAG_HANDLE_CLASS}
      />
    </LegacyWidgetWrapper>
  );
}

export function AcquisitionWidget({ metrics }: LegacyWidgetProps) {
  const get = useMetricGetter(metrics);
  const value = useMemo(() => formatCurrencyFixed(metrics?.totalAcquisitionValue?.result), [metrics]);
  return (
    <LegacyWidgetWrapper>
      <NumericCard
        value={value}
        label="Valor Total de Aquisição do Portfólio"
        variation={String(get('totalAcquisitionValue').variation)}
        positive={get('totalAcquisitionValue').isPositive}
        detailData={get('totalAcquisitionValue').data}
        detailColumns={COLS_ACQUISITION}
        dragHandleClassName={DRAG_HANDLE_CLASS}
      />
    </LegacyWidgetWrapper>
  );
}

export function VacancyGaugeWidget({ metrics }: LegacyWidgetProps) {
  const get = useMetricGetter(metrics);
  return (
    <LegacyWidgetWrapper>
      <EChartsGauge
        label="Índice de Vacância Financeira"
        value={get('financialVacancyRate').result}
        color="#8B5CF6"
        detailData={get('financialVacancyRate').data}
        detailColumns={COLS_FINANCIAL_VACANCY_GAUGE}
        dragHandleClassName={DRAG_HANDLE_CLASS}
      />
    </LegacyWidgetWrapper>
  );
}

export function VacancyMonthsWidget({ metrics }: LegacyWidgetProps) {
  const get = useMetricGetter(metrics);
  const value = useMemo(() => `${Math.round(metrics?.vacancyInMonths?.result ?? 0)} meses`, [metrics]);
  return (
    <LegacyWidgetWrapper>
      <NumericCard
        value={value}
        label="Total da Vacância em Meses"
        variation={String(get('vacancyInMonths').variation)}
        positive={get('vacancyInMonths').isPositive}
        detailData={get('vacancyInMonths').data}
        detailColumns={COLS_VACANCY_MONTHS}
        dragHandleClassName={DRAG_HANDLE_CLASS}
      />
    </LegacyWidgetWrapper>
  );
}
