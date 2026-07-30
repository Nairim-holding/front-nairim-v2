/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useCallback, useMemo, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { DashboardLayoutItem } from '@/hooks/useDashboardLayout';
import DashboardWidgetGrid, { DRAG_HANDLE_CLASS, type DashboardWidget } from '@/components/dashboard/DashboardWidgetGrid';
import { MetricResponse, MetricWithData } from '@/types/types';
import NumericCard from '@/components/charts/MetricCard';
import {
  COLS_TOTAL_PROPERTIES, COLS_PENDING_DOCS, COLS_SALE_VALUE,
  COLS_AVAILABILITY_DONUT, COLS_TYPES_DONUT, COLS_OCCUPATION_GAUGE, COLS_VACANCY_GAUGE,
} from '@/lib/columns';

const EChartsDonut = dynamic(() => import('@/components/charts/DonutChart'), { ssr: false });
const EChartsGauge = dynamic(() => import('@/components/charts/GaugeChart'), { ssr: false });
const StorageUsage = dynamic(() => import('@/components/dashboard/StorageUsageChart'), { ssr: false });
const DatabaseUsage = dynamic(() => import('@/components/dashboard/DatabaseUsageChart'), { ssr: false });

/** NumericCard/EChartsDonut/EChartsGauge têm moldura e altura próprias; dentro
 * da célula do grid precisam preencher exatamente a célula. */
function SelfFramedWidget({ children }: { children: ReactNode }) {
  return <div className="h-full [&>div]:h-full [&>div]:min-w-0">{children}</div>;
}

type MetricDataKeys = {
  [K in keyof MetricResponse]: MetricResponse[K] extends MetricWithData ? K : never;
}[keyof MetricResponse];

function useMetricGetter(metrics: MetricResponse | null) {
  return (k: MetricDataKeys): MetricWithData =>
    ((metrics?.[k] as MetricWithData) ?? { result: 0, variation: 0, isPositive: false, data: [] });
}

/**
 * Mesmo ritmo do grid do Financeiro: uma faixa de KPIs (w4 h3, três por linha)
 * e, abaixo, os gráficos sempre em pares w6 h8. Toda linha fecha as 12 colunas —
 * era o que faltava aqui: os dois gauges ocupavam w4 h3 e deixavam um vão de 4
 * colunas na linha, além de ficarem mais baixos e estreitos que os vizinhos.
 */
const DEFAULT_LAYOUT: DashboardLayoutItem[] = [
  // KPIs numéricos
  { i: 'widget-p1', x: 0, y: 0, w: 4, h: 3 },
  { i: 'widget-p2', x: 4, y: 0, w: 4, h: 3 },
  { i: 'widget-p3', x: 8, y: 0, w: 4, h: 3 },
  // Disponibilidade (rosca) | Taxa de Ocupação (medidor)
  { i: 'widget-p4', x: 0, y: 3, w: 6, h: 8 },
  { i: 'widget-p6', x: 6, y: 3, w: 6, h: 8 },
  // Carteira (rosca) | Taxa de Vacância Física (medidor)
  { i: 'widget-p5', x: 0, y: 11, w: 6, h: 8 },
  { i: 'widget-p7', x: 6, y: 11, w: 6, h: 8 },
  // Consumo: anexos | banco de dados
  { i: 'widget-p8', x: 0, y: 19, w: 6, h: 8 },
  { i: 'widget-p9', x: 6, y: 19, w: 6, h: 8 },
];

interface PortfolioDashboardGridProps {
  resource?: string;
  /** Métricas da seção Imóveis, já buscadas com o período do filtro da aba. */
  metrics: MetricResponse | null;
}

/**
 * Grid arrastável/redimensionável da aba Imóveis. Antes estes widgets viviam
 * soltos em um `flex flex-wrap`, sem drag/resize nem layout persistido — os
 * únicos recursos que faltavam para igualar a aba Financeiro.
 */
export default function PortfolioDashboardGrid({
  // v3: pareamento rosca+medidor por linha. O layout persistido vence o default,
  // então cada rearranjo precisa de uma chave nova para chegar a quem já tinha
  // layout salvo (mesma prática do 'financeiro-v5').
  resource = 'imoveis-v3',
  metrics,
}: PortfolioDashboardGridProps) {
  const get = useMetricGetter(metrics);

  const vacancyData = useMemo(
    () => (get('vacancyRate').data ?? []).map((item: any) => ({ ...item, status: 'AVAILABLE', areaTotal: item.areaTotal ?? 0 })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [metrics]
  );

  const occupationData = useMemo(
    () => (get('occupationRate').data ?? []).map((item: any) => ({ ...item, status: item.status || 'OCCUPIED' })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [metrics]
  );

  const typesData = useMemo(
    () => ((metrics?.availablePropertiesByType as any[]) ?? []).map((group) => ({
      ...group,
      data: group.data?.map((item: any) => ({ ...item })),
    })),
    [metrics]
  );

  const availabilityDonutData = useMemo(() => [
    { name: 'Disponíveis', value: get('vacancyRate').result, data: vacancyData },
    { name: 'Ocupados', value: get('occupationRate').result, data: occupationData },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [vacancyData, occupationData]);

  const renderWidget = useCallback(
    (id: string): DashboardWidget | null => {
      switch (id) {
        case 'widget-p1':
          return {
            framed: false,
            body: (
              <SelfFramedWidget>
                <NumericCard
                  value={String(get('totalPropertys').result)}
                  label="Total de Imóveis"
                  variation={String(get('totalPropertys').variation)}
                  positive={get('totalPropertys').isPositive}
                  detailData={get('totalPropertys').data}
                  detailColumns={COLS_TOTAL_PROPERTIES}
                  dragHandleClassName={DRAG_HANDLE_CLASS}
                />
              </SelfFramedWidget>
            ),
          };

        case 'widget-p2':
          return {
            framed: false,
            body: (
              <SelfFramedWidget>
                <NumericCard
                  value={String(get('countPropertiesWithLessThan3Docs').result)}
                  label="Imóveis com Documentação Pendente"
                  variation={String(get('countPropertiesWithLessThan3Docs').variation)}
                  positive={get('countPropertiesWithLessThan3Docs').isPositive}
                  detailData={get('countPropertiesWithLessThan3Docs').data}
                  detailColumns={COLS_PENDING_DOCS}
                  dragHandleClassName={DRAG_HANDLE_CLASS}
                />
              </SelfFramedWidget>
            ),
          };

        case 'widget-p3':
          return {
            framed: false,
            body: (
              <SelfFramedWidget>
                <NumericCard
                  value={String(get('totalPropertiesWithSaleValue').result)}
                  label="Imóveis com Valor de Venda Definido"
                  variation={String(get('totalPropertiesWithSaleValue').variation)}
                  positive={get('totalPropertiesWithSaleValue').isPositive}
                  detailData={get('totalPropertiesWithSaleValue').data}
                  detailColumns={COLS_SALE_VALUE}
                  dragHandleClassName={DRAG_HANDLE_CLASS}
                />
              </SelfFramedWidget>
            ),
          };

        case 'widget-p4':
          return {
            framed: false,
            body: (
              <SelfFramedWidget>
                <EChartsDonut
                  data={availabilityDonutData}
                  label="Imóveis por Status de Disponibilidade"
                  detailColumns={COLS_AVAILABILITY_DONUT}
                  dragHandleClassName={DRAG_HANDLE_CLASS}
                />
              </SelfFramedWidget>
            ),
          };

        case 'widget-p5':
          return {
            framed: false,
            body: (
              <SelfFramedWidget>
                <EChartsDonut
                  data={typesData}
                  label="Imóveis na Carteira"
                  colors={['#FF7777', '#77FF7B', '#F9FF53', '#77A2FF', '#E477FF']}
                  detailColumns={COLS_TYPES_DONUT}
                  dragHandleClassName={DRAG_HANDLE_CLASS}
                />
              </SelfFramedWidget>
            ),
          };

        case 'widget-p6':
          return {
            framed: false,
            body: (
              <SelfFramedWidget>
                <EChartsGauge
                  label="Taxa de Ocupação"
                  value={get('occupationRate').result}
                  color="#10B981"
                  detailData={get('occupationRate').data}
                  detailColumns={COLS_OCCUPATION_GAUGE}
                  dragHandleClassName={DRAG_HANDLE_CLASS}
                />
              </SelfFramedWidget>
            ),
          };

        case 'widget-p7':
          return {
            framed: false,
            body: (
              <SelfFramedWidget>
                <EChartsGauge
                  label="Taxa de Vacância Física"
                  value={get('vacancyRate').result}
                  color="#EF4444"
                  detailData={get('vacancyRate').data}
                  detailColumns={COLS_VACANCY_GAUGE}
                  dragHandleClassName={DRAG_HANDLE_CLASS}
                />
              </SelfFramedWidget>
            ),
          };

        // StorageUsage/DatabaseUsage são baseados em ChartCard: só cabeçalho e
        // corpo — a moldura do cartão vem do grid (framed: true).
        case 'widget-p8':
          return { body: <StorageUsage isDraggable />, framed: true };

        case 'widget-p9':
          return { body: <DatabaseUsage isDraggable />, framed: true };

        default:
          return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [metrics, availabilityDonutData, typesData]
  );

  return (
    <DashboardWidgetGrid
      resource={resource}
      defaultLayout={DEFAULT_LAYOUT}
      renderWidget={renderWidget}
    />
  );
}
