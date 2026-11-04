'use client';

import { useEffect, useState } from 'react';
import NumericCard from '@/components/charts/MetricCard';
import { buildReportActionParams } from '@/app/dashboard/(financeiro)/relatorios/_lib/buildReportQuery';
import { getDemonstrativoReportAction } from '@/server/actions/financial-report';
import { FINANCIAL_DETAIL_COLUMNS } from '@/components/dashboard/financialChartDetails';
import { formatCurrencyFixed } from '@/utils/displayFormatters';
import { formatPeriodLabel } from '@/utils/periodRange';
import { toReportFilters } from './DashboardDemonstrativoWidget';
import type { FinancialWidgetProps } from './types';

/** Mesma classe usada pelo ChartCard: a barra do título é a alça de arrastar. */
const DRAG_HANDLE_CLASS = 'widget-drag-handle';

interface TaxRow {
  id: string;
  eventDate: string;
  effectiveDate: string;
  description: string;
  type: string;
  category: string;
  subcategory: string;
  institution: string;
  card: string;
  supplier: string;
  center: string;
  status: string;
  value: number;
}

interface TaxesState { total: number; rows: TaxRow[] }

/**
 * Total de Impostos e Taxas do período: é a linha "Impostos" do Demonstrativo
 * (despesas de categorias classificadas como Impostos no DFC), no mesmo período,
 * regime e filtros do Resumo. Ao clicar, abre os lançamentos que formam o valor,
 * agrupados por subcategoria, nas mesmas colunas dos demais blocos.
 */
export default function TaxesWidget({ startDate, endDate, filters }: FinancialWidgetProps) {
  const regime = filters?.regime === 'competencia' ? 'competencia' : 'caixa';
  const [state, setState] = useState<TaxesState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      try {
        const raw = buildReportActionParams({ from: startDate, to: endDate, regime, filters: toReportFilters(filters) });
        raw.groupBy = 'subcategory';
        const result = await getDemonstrativoReportAction(raw);
        if (!result.ok) throw new Error(result.error);
        const line = result.data.lines.find((l) => l.key === 'impostos');
        const rows: TaxRow[] = (line?.groups ?? []).flatMap((group) =>
          group.items.map((item) => ({
            id: item.id,
            eventDate: String(item.event_date),
            effectiveDate: String(item.effective_date),
            description: item.description,
            type: 'Despesa',
            category: item.category?.name ?? '-',
            subcategory: item.subcategory?.name ?? group.label ?? '-',
            institution: item.financialInstitution?.name ?? '-',
            card: item.card?.name ?? '-',
            supplier: item.supplier?.name ?? '-',
            center: item.center?.name ?? '-',
            status: item.status,
            value: Number(item.amount),
          })),
        );
        if (!cancelled) setState({ total: line?.total ?? 0, rows });
      } catch (error) {
        console.error('[TaxesWidget] Erro ao carregar impostos:', error);
        if (!cancelled) setState({ total: 0, rows: [] });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [startDate, endDate, regime, filters]);

  const periodLabel = formatPeriodLabel(startDate, endDate);

  return (
    <div className="h-full [&>div]:h-full [&>div]:min-w-0">
      <NumericCard
        value={formatCurrencyFixed(state?.total ?? 0)}
        label={`Total de Impostos e Taxas${periodLabel ? ` — ${periodLabel}` : ''}`}
        loading={loading}
        detailData={state?.rows ?? []}
        detailColumns={FINANCIAL_DETAIL_COLUMNS}
        detailGroupBy={{ key: 'subcategory' }}
        detailTotalLabel="lançamentos"
        dragHandleClassName={DRAG_HANDLE_CLASS}
        openDetailsOnCardClick
      />
    </div>
  );
}
