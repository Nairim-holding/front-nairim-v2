'use client';

import ChartCard from '@/components/dashboard/ChartCard';
import DemonstrativoView from '@/app/dashboard/(financeiro)/relatorios/_components/DemonstrativoView';
import type { ReportFiltersState, ReportStatusFilter } from '@/app/dashboard/(financeiro)/relatorios/_lib/types';
import type { FinancialWidgetProps } from './types';

function valuesOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(item => String(item)).filter(Boolean);
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(item => String(item)).filter(Boolean);
  } catch {
    // Dynamic filters also send scalar strings for single selections.
  }
  return [value];
}

export function toReportFilters(filters: Record<string, unknown> | undefined): ReportFiltersState {
  const source = filters ?? {};
  const status = source.status;
  const reportStatus: ReportStatusFilter = status === 'PENDING' || status === 'all' ? status : 'COMPLETED';
  return {
    company_ids: valuesOf(source.company_ids),
    type: 'all',
    financial_institution_id: valuesOf(source.financial_institution_id),
    includeInactiveInstitutions: false,
    card_id: valuesOf(source.card_id),
    category_id: valuesOf(source.category_id),
    subcategory_id: valuesOf(source.subcategory_id),
    center_id: valuesOf(source.center_id),
    status: reportStatus,
  };
}

/**
 * Demonstrativo do Financeiro, usando o mesmo período, regime e filtros do dashboard.
 * Usa o ChartCard como os demais blocos: a barra do título é a alça de arrastar
 * (o usuário escolhe a posição no Resumo) e há o botão Expandir em tela cheia.
 */
export default function DashboardDemonstrativoWidget({ startDate, endDate, filters }: FinancialWidgetProps) {
  const regime = filters?.regime === 'competencia' ? 'competencia' : 'caixa';
  return (
    <ChartCard title={`Demonstrativo Financeiro — Regime de ${regime === 'caixa' ? 'Caixa' : 'Competência'}`}>
      {({ isFullscreen }) => (
        <div className={isFullscreen ? 'flex-1 overflow-auto' : 'absolute inset-0 overflow-auto'}>
          <DemonstrativoView
            hideTitle
            dateRange={{ from: startDate, to: endDate }}
            regime={regime}
            reportKind="sintetico"
            filters={toReportFilters(filters)}
          />
        </div>
      )}
    </ChartCard>
  );
}
