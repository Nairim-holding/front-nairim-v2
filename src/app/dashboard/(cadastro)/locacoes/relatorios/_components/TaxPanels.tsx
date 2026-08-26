'use client';

import { forwardRef } from 'react';
import { formatCurrency } from '@/utils/formatters';
import {
  WITHHOLDING_RATES,
  WITHHOLDING_TOTAL_RATE,
  type InvestmentRedemptionInput,
  type InvestmentRedemptionRow,
  type LeaseReportResult,
  type WithholdingTax,
} from '@/core/entities/lease-report';
import { monthShortLabel, quarterLabel } from '../_lib/referencePeriod';
import RedemptionInputs from './RedemptionInputs';

/**
 * Os quatro quadros que acompanham a tabela do Relatório de Locações,
 * reproduzindo a planilha que o cliente usa hoje:
 *
 *  1. Retenções dos Aluguéis — IRRF sofrido, só nos imóveis marcados.
 *  2. DARF mensal (PIS/COFINS) — sobre o faturamento total, abatida a retenção.
 *  3. Resgate de Aplicações Financeiras — rendimento digitado na tela.
 *  4. DARF trimestral (CSLL/IRPJ) — lucro presumido sobre o trimestre inteiro.
 *
 * Ficam num único componente porque saem do mesmo resultado e são exportados
 * juntos: `printReportElement` recebe este bloco como o "resumo" impresso
 * depois da tabela.
 */

const TAX_LABELS: Record<WithholdingTax, string> = {
  pis: 'PIS',
  cofins: 'COFINS',
  irpj: 'IRPJ',
  csll: 'CSLL',
};

const percent = (rate: number) => `${(rate * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

/**
 * As classes `report-panel*` e `report-panels` não estilizam nada na tela (o
 * visual vem do Tailwind) — existem para o CSS da janela de impressão, que não
 * carrega o Tailwind, poder mirar o markup real destes quadros. Ver
 * `lib/reports/exportHelpers.ts`.
 */
function Panel({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="report-panel rounded-xl border border-ui-border-soft overflow-hidden bg-surface">
      <div className="report-panel-title px-3 py-2 bg-surface-subtle border-b border-ui-border-soft text-[11px] font-bold uppercase tracking-wide text-content text-center">
        {title}
      </div>
      <div className="overflow-x-auto">{children}</div>
      {note && (
        <div className="report-panel-note px-3 py-2 text-[11px] text-content-muted border-t border-ui-border-soft">
          {note}
        </div>
      )}
    </div>
  );
}

const TH = 'px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-content-muted whitespace-nowrap';
const TD = 'px-3 py-1.5 text-sm text-content-secondary whitespace-nowrap';

interface TaxPanelsProps {
  data: LeaseReportResult;
  /** Linhas do quadro de Resgate, calculadas na tela a partir do que foi digitado. */
  redemptionRows: InvestmentRedemptionRow[];
  redemptions: InvestmentRedemptionInput[];
  onRedemptionsChange: (next: InvestmentRedemptionInput[]) => void;
}

const TaxPanels = forwardRef<HTMLDivElement, TaxPanelsProps>(function TaxPanels(
  { data, redemptionRows, redemptions, onRedemptionsChange },
  ref,
) {
  const taxes = Object.keys(WITHHOLDING_RATES) as WithholdingTax[];

  return (
    <div ref={ref} className="report-panels grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* ── 1. Retenções dos Aluguéis ─────────────────────────────────────── */}
      <Panel
        title="Retenções dos Aluguéis"
        note={`Base: ${formatCurrency(data.withholding.base)} — receita bruta dos imóveis marcados com IRRF no cadastro.`}
      >
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-ui-border-soft">
              <th className={`${TH} text-left`}>Impostos</th>
              {taxes.map((tax) => (
                <th key={tax} className={`${TH} text-right`}>{TAX_LABELS[tax]}</th>
              ))}
              <th className={`${TH} text-right`}>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-ui-border-soft/60">
              <td className={`${TD} font-semibold text-content`}>%</td>
              {taxes.map((tax) => (
                <td key={tax} className={`${TD} text-right`}>{percent(WITHHOLDING_RATES[tax])}</td>
              ))}
              <td className={`${TD} text-right font-semibold text-content`}>{percent(WITHHOLDING_TOTAL_RATE)}</td>
            </tr>
            <tr>
              <td className={`${TD} font-semibold text-content`}>Valor Retido</td>
              {taxes.map((tax) => (
                <td key={tax} className={`${TD} text-right`}>{formatCurrency(data.withholding.amounts[tax])}</td>
              ))}
              <td className={`${TD} text-right font-bold text-content`}>{formatCurrency(data.withholding.total)}</td>
            </tr>
          </tbody>
        </table>
      </Panel>

      {/* ── 2. DARF mensal (PIS/COFINS) ───────────────────────────────────── */}
      <Panel title="DARF Mensal — Faturamento de Aluguéis">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-ui-border-soft">
              <th className={`${TH} text-left`}>Mês</th>
              <th className={`${TH} text-left`}>Imposto</th>
              <th className={`${TH} text-right`}>Faturamento</th>
              <th className={`${TH} text-right`}>%</th>
              <th className={`${TH} text-right`}>Imposto Mensal</th>
              <th className={`${TH} text-right`}>A Pagar (ded. retenção)</th>
            </tr>
          </thead>
          <tbody>
            {data.monthlyDarf.length === 0 && (
              <tr><td className={`${TD} text-center`} colSpan={6}>Sem faturamento no período.</td></tr>
            )}
            {data.monthlyDarf.map((row) => (
              <tr key={`${row.reference.year}-${row.reference.month}-${row.tax}`} className="border-b border-ui-border-soft/60">
                <td className={TD}>{monthShortLabel(row.reference)}</td>
                <td className={`${TD} font-semibold text-content`}>DARF {TAX_LABELS[row.tax]}</td>
                <td className={`${TD} text-right`}>{formatCurrency(row.revenue)}</td>
                <td className={`${TD} text-right`}>{percent(row.rate)}</td>
                <td className={`${TD} text-right`}>{formatCurrency(row.darf)}</td>
                <td className={`${TD} text-right font-bold text-content`}>{formatCurrency(row.payable)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {/* ── 3. Resgate de Aplicações Financeiras ──────────────────────────── */}
      <Panel title="Resgate de Aplicações Financeiras — Trimestral">
        <RedemptionInputs
          rows={redemptionRows}
          redemptions={redemptions}
          onChange={onRedemptionsChange}
        />
      </Panel>

      {/* ── 4. DARF trimestral (CSLL/IRPJ) ────────────────────────────────── */}
      <Panel
        title="DARF Trimestral — Lucro Presumido"
        note="O trimestre entra inteiro, mesmo que só parte dos meses tenha sido selecionada — o DARF trimestral incide sobre os três meses."
      >
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-ui-border-soft">
              <th className={`${TH} text-left`}>Período</th>
              <th className={`${TH} text-left`}>Imposto</th>
              <th className={`${TH} text-right`}>Faturamento</th>
              <th className={`${TH} text-right`}>%</th>
              <th className={`${TH} text-right`}>Imposto Trimestral</th>
              <th className={`${TH} text-right`}>A Pagar (ded. retenção)</th>
            </tr>
          </thead>
          <tbody>
            {data.quarterlyDarf.length === 0 && (
              <tr><td className={`${TD} text-center`} colSpan={6}>Sem faturamento no período.</td></tr>
            )}
            {data.quarterlyDarf.map((row) => (
              <tr key={`${row.reference.year}-${row.reference.quarter}-${row.tax}`} className="border-b border-ui-border-soft/60">
                <td className={TD}>{quarterLabel(row.reference)}</td>
                <td className={`${TD} font-semibold text-content`}>DARF {TAX_LABELS[row.tax]}</td>
                <td className={`${TD} text-right`}>{formatCurrency(row.revenue)}</td>
                <td className={`${TD} text-right`}>{percent(row.rate)}</td>
                <td className={`${TD} text-right`}>{formatCurrency(row.darf)}</td>
                <td className={`${TD} text-right font-bold text-content`}>{formatCurrency(row.payable)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
});

export default TaxPanels;
