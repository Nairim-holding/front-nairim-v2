'use client';

import { forwardRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/utils';
import { ROI_WARNING_LABELS, type RoiPropertyRow } from '@/core/entities/property-roi';
import { formatDecimal, formatRate } from '../_lib/format';

interface RoiTableProps {
  rows: RoiPropertyRow[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (propertyId: string) => void;
}

const HEADERS = [
  'Imóvel', 'Valor de compra', 'Investimento inicial', 'Aluguel mensal', 'Receita líquida anual',
  'Despesas anuais', 'Fluxo de caixa anual', 'ROI anual', 'Cap Rate', 'Retorno (anos)', 'Retorno (meses)',
];

/** Grid do ROI: uma linha por imóvel. Clicar na linha abre o detalhamento do cálculo. */
const RoiTable = forwardRef<HTMLTableElement, RoiTableProps>(function RoiTable({ rows, isLoading, selectedId, onSelect }, ref) {
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
                  {row.propertyTitle}
                  {row.warnings.length > 0 && (
                    <span className="no-export text-amber-500" title={row.warnings.map((warning) => ROI_WARNING_LABELS[warning]).join('\n')}>
                      <AlertTriangle size={14} />
                    </span>
                  )}
                </span>
              </td>
              <td className="border-b border-ui-border-soft p-2 text-right">{row.purchaseValue > 0 ? formatCurrency(row.purchaseValue) : '—'}</td>
              <td className="border-b border-ui-border-soft p-2 text-right">{formatCurrency(row.totalInvestment)}</td>
              <td className="border-b border-ui-border-soft p-2 text-right">{formatCurrency(row.monthlyRent)}</td>
              <td className="border-b border-ui-border-soft p-2 text-right">{formatCurrency(row.netAnnualRevenue)}</td>
              <td className="border-b border-ui-border-soft p-2 text-right">{formatCurrency(row.totalAnnualExpenses)}</td>
              <td className={`border-b border-ui-border-soft p-2 text-right font-medium ${row.annualCashFlow < 0 ? 'text-red-600' : ''}`}>{formatCurrency(row.annualCashFlow)}</td>
              <td className="border-b border-ui-border-soft p-2 text-right font-semibold">{formatRate(row.roi)}</td>
              <td className="border-b border-ui-border-soft p-2 text-right">{formatRate(row.capRate)}</td>
              <td className="border-b border-ui-border-soft p-2 text-right">{formatDecimal(row.paybackYears)}</td>
              <td className="border-b border-ui-border-soft p-2 text-right">{formatDecimal(row.paybackMonths, 0)}</td>
            </tr>
          ))}
        </tbody>
        {!isLoading && rows.length > 1 && (
          <tfoot>
            <tr className="font-semibold">
              <td className="p-2">Total ({rows.length} imóveis)</td>
              <td className="p-2 text-right">{formatCurrency(totals.purchaseValue)}</td>
              <td className="p-2 text-right">{formatCurrency(totals.totalInvestment)}</td>
              <td className="p-2 text-right" />
              <td className="p-2 text-right">{formatCurrency(totals.netAnnualRevenue)}</td>
              <td className="p-2 text-right">{formatCurrency(totals.totalAnnualExpenses)}</td>
              <td className="p-2 text-right">{formatCurrency(totals.annualCashFlow)}</td>
              <td className="p-2 text-right">{formatRate(portfolioRoi)}</td>
              <td className="p-2 text-right">{formatRate(portfolioCapRate)}</td>
              <td className="p-2 text-right">{formatDecimal(portfolioPayback)}</td>
              <td className="p-2 text-right">{formatDecimal(portfolioPayback === null ? null : portfolioPayback * 12, 0)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
});

export default RoiTable;
