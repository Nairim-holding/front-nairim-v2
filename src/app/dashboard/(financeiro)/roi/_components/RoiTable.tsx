'use client';

import { forwardRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/utils';
import { ROI_WARNING_LABELS, type RoiPropertyRow } from '@/core/entities/property-roi';
import type { RoiMetricKey } from '@/core/entities/property-roi-origin';
import { formatDecimal, formatRate } from '../_lib/format';

interface RoiTableProps {
  rows: RoiPropertyRow[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (propertyId: string) => void;
  onInspect: (propertyIds: string[], metric: RoiMetricKey) => void;
}

const HEADERS = [
  'Imóvel', 'Valor de compra', 'Investimento inicial', 'Aluguel mensal', 'Receita líquida anual',
  'Despesas anuais', 'Fluxo de caixa anual', 'ROI anual', 'Cap Rate', 'Retorno (anos)', 'Retorno (meses)',
];

const VALUE_COLUMNS: Array<{ metric: RoiMetricKey; label: string; format: (value: number | null) => string }> = [
  { metric: 'purchaseValue', label: 'Valor de compra', format: value => value !== null && value > 0 ? formatCurrency(value) : '—' },
  { metric: 'totalInvestment', label: 'Investimento inicial', format: value => formatCurrency(value ?? 0) },
  { metric: 'monthlyRent', label: 'Aluguel mensal', format: value => formatCurrency(value ?? 0) },
  { metric: 'netAnnualRevenue', label: 'Receita líquida anual', format: value => formatCurrency(value ?? 0) },
  { metric: 'totalAnnualExpenses', label: 'Despesas anuais', format: value => formatCurrency(value ?? 0) },
  { metric: 'annualCashFlow', label: 'Fluxo de caixa anual', format: value => formatCurrency(value ?? 0) },
  { metric: 'roi', label: 'ROI anual', format: formatRate },
  { metric: 'capRate', label: 'Cap Rate', format: formatRate },
  { metric: 'paybackYears', label: 'Retorno (anos)', format: formatDecimal },
  { metric: 'paybackMonths', label: 'Retorno (meses)', format: value => formatDecimal(value, 0) },
];

/** Grid do ROI: uma linha por imóvel. Clicar na linha abre o detalhamento do cálculo. */
const RoiTable = forwardRef<HTMLTableElement, RoiTableProps>(function RoiTable({ rows, isLoading, selectedId, onSelect, onInspect }, ref) {
  const totals = rows.reduce(
    (acc, row) => ({
      purchaseValue: acc.purchaseValue + row.purchaseValue,
      totalInvestment: acc.totalInvestment + row.totalInvestment,
      netAnnualRevenue: acc.netAnnualRevenue + row.netAnnualRevenue,
      totalAnnualExpenses: acc.totalAnnualExpenses + row.totalAnnualExpenses,
      annualCashFlow: acc.annualCashFlow + row.annualCashFlow,
    }),
    { purchaseValue: 0, totalInvestment: 0, netAnnualRevenue: 0, totalAnnualExpenses: 0, annualCashFlow: 0 },
  );
  // Indicadores da carteira: o mesmo cálculo, sobre a soma dos imóveis listados.
  const portfolioRoi = totals.totalInvestment > 0 ? totals.annualCashFlow / totals.totalInvestment : null;
  const portfolioCapRate = totals.purchaseValue > 0 ? totals.annualCashFlow / totals.purchaseValue : null;
  const portfolioPayback = totals.totalInvestment > 0 && totals.annualCashFlow > 0 ? totals.totalInvestment / totals.annualCashFlow : null;
  const portfolioValues: Partial<Record<RoiMetricKey, number | null>> = {
    ...totals, roi: portfolioRoi, capRate: portfolioCapRate,
    paybackYears: portfolioPayback, paybackMonths: portfolioPayback === null ? null : portfolioPayback * 12,
  };

  const valueButton = (metric: RoiMetricKey, label: string, text: string, propertyIds: string[], scope: string) => (
    <button type="button" data-roi-metric={metric}
      className="rounded-sm text-inherit underline decoration-dotted underline-offset-4 hover:text-brand focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2"
      aria-label={`Ver origem de ${label} ${scope}`} title="Ver origem do valor"
      onClick={event => { event.stopPropagation(); onInspect(propertyIds, metric); }}>{text}</button>
  );

  return (
    <div className="overflow-auto rounded-xl border border-ui-border-soft bg-surface">
      <table ref={ref} className="w-full min-w-[1200px] text-left text-sm text-content">
        <thead>
          <tr>
            {HEADERS.map((label, index) => (
              <th key={label} className={`border-b border-ui-border bg-surface-subtle p-2 text-xs font-semibold text-content-secondary ${index === 0 ? '' : 'text-right'}`}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr><td colSpan={HEADERS.length} className="p-10 text-center text-content-muted">Calculando…</td></tr>
          )}
          {!isLoading && rows.length === 0 && (
            <tr><td colSpan={HEADERS.length} className="p-10 text-center text-content-muted">Nenhum imóvel encontrado.</td></tr>
          )}
          {!isLoading && rows.map((row) => (
            <tr
              key={row.propertyId}
              onClick={() => onSelect(row.propertyId)}
              aria-selected={row.propertyId === selectedId}
              className={`cursor-pointer transition-colors hover:bg-surface-subtle ${row.propertyId === selectedId ? 'bg-brand/5' : ''}`}
            >
              <td className="border-b border-ui-border-soft p-2 font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <button type="button" className="rounded-sm text-left hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
                    aria-label={`Ver detalhamento do ROI de ${row.propertyTitle}`}
                    onClick={event => { event.stopPropagation(); onSelect(row.propertyId); }}>{row.propertyTitle}</button>
                  {row.warnings.length > 0 && (
                    <span className="no-export text-amber-500" title={row.warnings.map((warning) => ROI_WARNING_LABELS[warning]).join('\n')}>
                      <AlertTriangle size={14} />
                    </span>
                  )}
                </span>
              </td>
              {VALUE_COLUMNS.map(column => <td key={column.metric}
                className={`border-b border-ui-border-soft p-2 text-right whitespace-nowrap ${column.metric === 'roi' ? 'font-semibold' : ''} ${column.metric === 'annualCashFlow' && row.annualCashFlow < 0 ? 'text-red-600' : ''}`}>
                {valueButton(column.metric, column.label, column.format(row[column.metric]), [row.propertyId], `de ${row.propertyTitle}`)}
              </td>)}
            </tr>
          ))}
        </tbody>
        {!isLoading && rows.length > 1 && (
          <tfoot>
            <tr className="font-semibold">
              <td className="p-2">Total ({rows.length} imóveis)</td>
              {VALUE_COLUMNS.map(column => <td key={column.metric} className="p-2 text-right whitespace-nowrap">
                {column.metric !== 'monthlyRent' && valueButton(column.metric, column.label,
                  column.metric === 'purchaseValue' ? formatCurrency(totals.purchaseValue) : column.format(portfolioValues[column.metric] ?? null),
                  rows.map(row => row.propertyId), 'da carteira')}
              </td>)}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
});

export default RoiTable;
