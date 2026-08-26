'use client';

import { formatCurrency } from '@/utils/formatters';
import { formatCurrencyRealtime } from '@/utils/masks';
import type { InvestmentRedemptionInput, InvestmentRedemptionRow } from '@/core/entities/lease-report';
import { quarterLabel } from '../_lib/referencePeriod';

/**
 * Quadro "Resgate de Aplicações Financeiras" — Rendimento e IR Retido são
 * DIGITADOS aqui, não derivados do Financeiro.
 *
 * Motivo: não há no sistema nada que identifique com segurança um resgate de
 * aplicação (é uma transferência entre contas da mesma empresa, sem categoria
 * própria obrigatória). Inferir por categoria daria um número errado em
 * silêncio; digitar deixa o dado explícito e conferível. Decisão tomada com o
 * cliente na especificação de 23/08/26.
 *
 * Os valores não são persistidos: valem para a emissão em tela e para a
 * exportação/impressão daquele momento.
 */

const TAX_LABELS = { csll: 'CSLL', irpj: 'IRPJ' } as const;
const TH = 'px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-content-muted whitespace-nowrap';
const TD = 'px-3 py-1.5 text-sm text-content-secondary whitespace-nowrap';

const percent = (rate: number) => `${(rate * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

/** Converte o texto mascarado ("R$ 1.234,56") de volta para número. */
const parseMasked = (value: string): number => {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits) / 100 : 0;
};

interface RedemptionInputsProps {
  /** Linhas calculadas (2 por trimestre: CSLL e IRPJ). */
  rows: InvestmentRedemptionRow[];
  /** Valores digitados, um por trimestre. */
  redemptions: InvestmentRedemptionInput[];
  onChange: (next: InvestmentRedemptionInput[]) => void;
}

export default function RedemptionInputs({ rows, redemptions, onChange }: RedemptionInputsProps) {
  // As linhas vêm em pares por trimestre; a edição é por trimestre, então a
  // primeira linha de cada par carrega os dois inputs com rowSpan.
  const quarters = rows.filter((row) => row.tax === 'csll').map((row) => row.reference);

  const valueFor = (year: number, quarter: number): InvestmentRedemptionInput =>
    redemptions.find((r) => r.year === year && r.quarter === quarter) ?? { year, quarter, income: 0, tax_withheld: 0 };

  const update = (year: number, quarter: number, patch: Partial<InvestmentRedemptionInput>) => {
    const current = valueFor(year, quarter);
    const next = { ...current, ...patch };
    onChange([...redemptions.filter((r) => !(r.year === year && r.quarter === quarter)), next]);
  };

  if (quarters.length === 0) {
    return <div className="px-3 py-6 text-center text-sm text-content-muted">Selecione um mês de referência.</div>;
  }

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-ui-border-soft">
          <th className={`${TH} text-left`}>Período</th>
          <th className={`${TH} text-left`}>Imposto</th>
          <th className={`${TH} text-right`}>Rendimento</th>
          <th className={`${TH} text-right`}>IR Retido</th>
          <th className={`${TH} text-right`}>Alíquota</th>
          <th className={`${TH} text-right`}>Total</th>
        </tr>
      </thead>
      <tbody>
        {quarters.map((reference) => {
          const input = valueFor(reference.year, reference.quarter);
          const pair = rows.filter((row) => row.reference.year === reference.year && row.reference.quarter === reference.quarter);

          return pair.map((row, index) => (
            <tr key={`${reference.year}-${reference.quarter}-${row.tax}`} className="border-b border-ui-border-soft/60">
              {index === 0 && <td className={TD} rowSpan={pair.length}>{quarterLabel(reference)}</td>}
              <td className={`${TD} font-semibold text-content`}>DARF {TAX_LABELS[row.tax]}</td>

              {index === 0 && (
                <>
                  <td className={`${TD} text-right`} rowSpan={pair.length}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={input.income > 0 ? formatCurrency(input.income) : ''}
                      placeholder="R$ 0,00"
                      onChange={(e) => update(reference.year, reference.quarter, { income: parseMasked(formatCurrencyRealtime(e.target.value)) })}
                      className="w-32 px-2 py-1 text-right rounded-lg border border-ui-border-soft bg-surface text-content focus:outline-none focus:border-brand"
                    />
                  </td>
                  <td className={`${TD} text-right`} rowSpan={pair.length}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={input.tax_withheld > 0 ? formatCurrency(input.tax_withheld) : ''}
                      placeholder="R$ 0,00"
                      onChange={(e) => update(reference.year, reference.quarter, { tax_withheld: parseMasked(formatCurrencyRealtime(e.target.value)) })}
                      className="w-32 px-2 py-1 text-right rounded-lg border border-ui-border-soft bg-surface text-content focus:outline-none focus:border-brand"
                    />
                  </td>
                </>
              )}

              <td className={`${TD} text-right`}>{percent(row.rate)}</td>
              <td className={`${TD} text-right font-bold text-content`}>{formatCurrency(row.payable)}</td>
            </tr>
          ));
        })}
      </tbody>
    </table>
  );
}
