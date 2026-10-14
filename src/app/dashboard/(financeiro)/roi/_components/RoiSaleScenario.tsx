'use client';

import { useMemo, useState } from 'react';
import { formatCurrency } from '@/utils';
import { computeSaleScenario, type RoiPropertyRow } from '@/core/entities/property-roi';
import { formatRate } from '../_lib/format';

interface RoiSaleScenarioProps {
  rows: RoiPropertyRow[];
}

const inputClass = 'mt-1 block w-28 rounded-lg border border-ui-border bg-surface px-2 py-1.5 text-sm text-content focus:outline-none focus:border-brand';

/**
 * Aba "Cenários de Valorização" da planilha: projeção de venda futura por
 * imóvel. As premissas são digitadas na tela e não ficam salvas.
 */
export default function RoiSaleScenario({ rows }: RoiSaleScenarioProps) {
  const [years, setYears] = useState('5');
  const [appreciation, setAppreciation] = useState('6');
  const [brokerage, setBrokerage] = useState('6');
  const [tax, setTax] = useState('15');

  const number = (value: string) => {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  };

  const scenarios = useMemo(() => rows
    .filter((row) => row.purchaseValue > 0)
    .map((row) => ({
      row,
      scenario: computeSaleScenario({
        purchaseValue: row.purchaseValue,
        totalInvestment: row.totalInvestment,
        annualCashFlow: row.annualCashFlow,
        years: number(years),
        appreciationRate: number(appreciation) / 100,
        brokerageRate: number(brokerage) / 100,
        capitalGainsTaxRate: number(tax) / 100,
      }),
    })), [rows, years, appreciation, brokerage, tax]);

  const skipped = rows.length - scenarios.length;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-ui-border-soft bg-surface p-4">
        <label className="text-xs text-content-secondary">Anos até a venda
          <input type="number" min="0" step="1" value={years} onChange={(event) => setYears(event.target.value)} className={inputClass} />
        </label>
        <label className="text-xs text-content-secondary">Valorização anual (%)
          <input type="number" min="0" step="0.1" value={appreciation} onChange={(event) => setAppreciation(event.target.value)} className={inputClass} />
        </label>
        <label className="text-xs text-content-secondary">Corretagem na venda (%)
          <input type="number" min="0" step="0.1" value={brokerage} onChange={(event) => setBrokerage(event.target.value)} className={inputClass} />
        </label>
        <label className="text-xs text-content-secondary">IR sobre o ganho (%)
          <input type="number" min="0" step="0.1" value={tax} onChange={(event) => setTax(event.target.value)} className={inputClass} />
        </label>
        <p className="max-w-md text-[11px] text-content-muted">
          Preço projetado = valor de compra × (1 + valorização)^anos. Lucro bruto = preço − corretagem − investimento inicial.
          ROI global = (fluxo de caixa anual × anos + lucro líquido da venda) ÷ investimento inicial.
        </p>
      </div>

      <div className="overflow-auto rounded-xl border border-ui-border-soft bg-surface">
        <table className="w-full min-w-[1000px] text-left text-sm text-content">
          <thead>
            <tr>
              {['Imóvel', 'Valor de compra', 'Preço de venda projetado', 'Custo de venda', 'Lucro bruto na venda', 'IR estimado', 'Lucro líquido da venda', 'ROI global'].map((label, index) => (
                <th key={label} className={`border-b border-ui-border bg-surface-subtle p-2 text-xs font-semibold text-content-secondary ${index === 0 ? '' : 'text-right'}`}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scenarios.map(({ row, scenario }) => (
              <tr key={row.propertyId}>
                <td className="border-b border-ui-border-soft p-2 font-medium">{row.propertyTitle}</td>
                <td className="border-b border-ui-border-soft p-2 text-right">{formatCurrency(row.purchaseValue)}</td>
                <td className="border-b border-ui-border-soft p-2 text-right">{formatCurrency(scenario.projectedSalePrice)}</td>
                <td className="border-b border-ui-border-soft p-2 text-right">{formatCurrency(scenario.saleCost)}</td>
                <td className={`border-b border-ui-border-soft p-2 text-right ${scenario.grossProfit < 0 ? 'text-red-600' : ''}`}>{formatCurrency(scenario.grossProfit)}</td>
                <td className="border-b border-ui-border-soft p-2 text-right">{formatCurrency(scenario.capitalGainsTax)}</td>
                <td className={`border-b border-ui-border-soft p-2 text-right ${scenario.netProfit < 0 ? 'text-red-600' : ''}`}>{formatCurrency(scenario.netProfit)}</td>
                <td className="border-b border-ui-border-soft p-2 text-right font-semibold">{formatRate(scenario.globalRoi)}</td>
              </tr>
            ))}
            {scenarios.length === 0 && (
              <tr><td colSpan={8} className="p-10 text-center text-content-muted">Nenhum imóvel com valor de compra para projetar.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {skipped > 0 && (
        <p className="text-xs text-content-muted">{skipped} imóvel(is) sem valor de compra no cadastro ficaram fora da projeção.</p>
      )}
    </section>
  );
}
