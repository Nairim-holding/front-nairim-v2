'use client';

import { useCallback, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { DashboardLayoutItem } from '@/hooks/useDashboardLayout';
import DashboardWidgetGrid, { DRAG_HANDLE_CLASS, type DashboardWidget } from '@/components/dashboard/DashboardWidgetGrid';
import { MetricResponse, MetricWithData } from '@/types/types';
import NumericCard from '@/components/charts/MetricCard';
import TenantTenureChart from '@/components/dashboard/TenantTenureChart';
import {
  COLS_OWNERS, COLS_TENANTS, COLS_PROPERTIES_PER_OWNER, COLS_AGENCIES, COLS_PROPERTIES_BY_AGENCY,
} from '@/lib/columns';

const EChartsBar = dynamic(() => import('@/components/charts/BarChart'), { ssr: false });

/** NumericCard/EChartsBar têm moldura e altura próprias; dentro da célula do
 * grid precisam preencher exatamente a célula (sem sobra embaixo nem estouro). */
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

const DEFAULT_LAYOUT: DashboardLayoutItem[] = [
  { i: 'widget-c2', x: 0, y: 0, w: 3, h: 3 },
  { i: 'widget-c3', x: 3, y: 0, w: 3, h: 3 },
  { i: 'widget-c4', x: 6, y: 0, w: 3, h: 3 },
  { i: 'widget-c5', x: 9, y: 0, w: 3, h: 3 },
  { i: 'widget-c1', x: 0, y: 3, w: 6, h: 8 },
  { i: 'widget-c6', x: 6, y: 3, w: 6, h: 8 },
];

interface ClientsDashboardGridProps {
  resource?: string;
  /** Métricas da seção Clientes, já buscadas com o período do filtro da aba. */
  metrics: MetricResponse | null;
  /** Período do filtro da aba, para os widgets que buscam os próprios dados. */
  startDate: string;
  endDate: string;
}

export default function ClientsDashboardGrid({
  resource = 'clientes-v1',
  metrics,
  startDate,
  endDate,
}: ClientsDashboardGridProps) {
  const get = useMetricGetter(metrics);

  const renderWidget = useCallback(
    (id: string): DashboardWidget | null => {
      switch (id) {
        case 'widget-c1':
          return {
            body: <TenantTenureChart startDate={startDate} endDate={endDate} />,
            framed: true,
          };

        case 'widget-c2':
          return {
            framed: false,
            body: (
              <SelfFramedWidget>
                <NumericCard
                  value={String(get('ownersTotal').result)}
                  label="Total de Proprietários"
                  variation={String(get('ownersTotal').variation)}
                  positive={get('ownersTotal').isPositive}
                  detailData={get('ownersTotal').data}
                  detailColumns={COLS_OWNERS}
                  dragHandleClassName={DRAG_HANDLE_CLASS}
                />
              </SelfFramedWidget>
            ),
          };

        case 'widget-c3':
          return {
            framed: false,
            body: (
              <SelfFramedWidget>
                <NumericCard
                  value={String(get('tenantsTotal').result)}
                  label="Total de Inquilinos"
                  variation={String(get('tenantsTotal').variation)}
                  positive={get('tenantsTotal').isPositive}
                  detailData={get('tenantsTotal').data}
                  detailColumns={COLS_TENANTS}
                  dragHandleClassName={DRAG_HANDLE_CLASS}
                />
              </SelfFramedWidget>
            ),
          };

        case 'widget-c4':
          return {
            framed: false,
            body: (
              <SelfFramedWidget>
                <NumericCard
                  value={get('propertiesPerOwner').result?.toFixed(2) || '0'}
                  label="Média de Imóveis por Proprietário"
                  variation={String(get('propertiesPerOwner').variation)}
                  positive={get('propertiesPerOwner').isPositive}
                  detailData={get('propertiesPerOwner').data}
                  detailColumns={COLS_PROPERTIES_PER_OWNER}
                  dragHandleClassName={DRAG_HANDLE_CLASS}
                />
              </SelfFramedWidget>
            ),
          };

        case 'widget-c5':
          return {
            framed: false,
            body: (
              <SelfFramedWidget>
                <NumericCard
                  value={String(get('agenciesTotal').result)}
                  label="Total de Imobiliárias"
                  variation={String(get('agenciesTotal').variation)}
                  positive={get('agenciesTotal').isPositive}
                  detailData={get('agenciesTotal').data}
                  detailColumns={COLS_AGENCIES}
                  dragHandleClassName={DRAG_HANDLE_CLASS}
                />
              </SelfFramedWidget>
            ),
          };

        case 'widget-c6':
          return {
            framed: false,
            body: (
              <SelfFramedWidget>
                <EChartsBar
                  data={metrics?.propertiesByAgency ?? []}
                  label="Imóveis por Imobiliárias"
                  detailColumns={COLS_PROPERTIES_BY_AGENCY}
                  dragHandleClassName={DRAG_HANDLE_CLASS}
                />
              </SelfFramedWidget>
            ),
          };

        default:
          return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [metrics, startDate, endDate]
  );

  return (
    <DashboardWidgetGrid
      resource={resource}
      defaultLayout={DEFAULT_LAYOUT}
      renderWidget={renderWidget}
    />
  );
}
