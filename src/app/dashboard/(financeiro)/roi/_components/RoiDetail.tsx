'use client';

import { formatCurrency } from '@/utils';
import { ROI_LINE_DEFINITIONS, ROI_WARNING_LABELS, type RoiLineKey, type RoiPropertyRow } from '@/core/entities/property-roi';
import type { RoiMetricKey } from '@/core/entities/property-roi-origin';
import { formatDecimal, formatIsoDate, formatRate } from '../_lib/format';

interface RoiDetailProps {
  row: RoiPropertyRow;
  periodLabel: string;
  onInspect: (metric: RoiMetricKey) => void;
}

interface DetailLine {
  metric: RoiMetricKey;
  label: string;
  value: string;
  /** Como o valor é obtido / calculado. */
  how: string;
  total?: boolean;
}

const sourceOf = (key: RoiLineKey) => ROI_LINE_DEFINITIONS.find((definition) => definition.key === key)?.source ?? '';

/**
 * Detalhamento do ROI de um imóvel no formato da planilha do cliente: os
 * quatro blocos, com o valor e a explicação de onde ele vem ou como é calculado.
 */
export default function RoiDetail({ row, periodLabel, onInspect }: RoiDetailProps) {
  const blocks: Array<{ title: string; lines: DetailLine[] }> = [
    {
      title: '1. Investimento inicial (saídas de caixa)',
      lines: [
        { metric: 'purchaseValue', label: 'Valor de Compra do Imóvel', value: row.purchaseValue > 0 ? formatCurrency(row.purchaseValue) : '—', how: `Cadastro do imóvel, campo "Valor do Imóvel (Compra)". Data da compra: ${formatIsoDate(row.purchaseDate)}.` },
        { metric: 'itbi', label: 'Impostos (ITBI)', value: formatCurrency(row.itbi), how: sourceOf('itbi') },
        { metric: 'registry', label: 'Custos de Cartório e Escritura', value: formatCurrency(row.registry), how: sourceOf('registry') },
        { metric: 'initialRenovation', label: 'Reformas e Benfeitorias Iniciais', value: formatCurrency(row.initialRenovation), how: 'Manutenção de Imóveis lançada no Centro de Custo do imóvel até 1 ano após a data da compra.' },
        { metric: 'totalInvestment', label: 'Total do Investimento Inicial', value: formatCurrency(row.totalInvestment), how: 'Soma dos itens acima.', total: true },
      ],
    },
    {
      title: '2. Receitas anuais estimadas',
      lines: [
        { metric: 'monthlyRent', label: 'Aluguel Mensal Estimado', value: formatCurrency(row.monthlyRent), how: `${formatCurrency(row.rentReceived)} de aluguéis recebidos ÷ ${row.monthsLeased} mês(es) em que o imóvel ficou locado. ${sourceOf('rent')}` },
        { metric: 'grossAnnualRevenue', label: 'Receita Bruta Anual (12 meses)', value: formatCurrency(row.grossAnnualRevenue), how: 'Aluguel mensal estimado × 12.' },
        { metric: 'vacancyAmount', label: 'Previsão de Vacância Anual', value: formatCurrency(-row.vacancyAmount), how: `Aluguel mensal estimado × ${formatDecimal(row.vacancyMonths, 2)} mês(es) de vacância por ano, informados no cadastro do imóvel.` },
        { metric: 'netAnnualRevenue', label: 'Total de Receitas Líquidas Anuais', value: formatCurrency(row.netAnnualRevenue), how: 'Receita bruta anual − previsão de vacância.', total: true },
      ],
    },
    {
      title: '3. Despesas e custos anuais',
      lines: [
        { metric: 'iptuAnnual', label: 'IPTU Anual', value: formatCurrency(row.iptuAnnual), how: sourceOf('iptu') },
        { metric: 'insuranceAnnual', label: 'Seguro Incêndio/Imóvel Anual', value: formatCurrency(row.insuranceAnnual), how: sourceOf('insurance') },
        { metric: 'commissionAnnual', label: 'Taxa de Administração da Imobiliária', value: formatCurrency(row.commissionAnnual), how: sourceOf('commission') },
        { metric: 'maintenanceAnnual', label: 'Manutenção Periódica', value: formatCurrency(row.maintenanceAnnual), how: 'Manutenção de Imóveis lançada no Centro de Custo do imóvel depois de 1 ano da compra, no período de referência.' },
        { metric: 'totalAnnualExpenses', label: 'Total de Despesas Anuais', value: formatCurrency(row.totalAnnualExpenses), how: `Soma dos itens acima. Período de referência: ${periodLabel} (valores convertidos para 12 meses).`, total: true },
      ],
    },
    {
      title: '4. Indicadores de performance e retorno',
      lines: [
        { metric: 'annualCashFlow', label: 'Fluxo de Caixa Líquido Anual', value: formatCurrency(row.annualCashFlow), how: `Receitas líquidas − despesas (${formatCurrency(row.netAnnualRevenue)} − ${formatCurrency(row.totalAnnualExpenses)}). É o que sobra do aluguel por ano.` },
        { metric: 'roi', label: 'ROI Anual', value: formatRate(row.roi), how: 'Fluxo de caixa líquido anual ÷ total do investimento inicial. Retorno sobre tudo o que foi gasto (compra + taxas + reforma).', total: true },
        { metric: 'capRate', label: 'Cap Rate', value: formatRate(row.capRate), how: 'Fluxo de caixa líquido anual ÷ valor de compra do imóvel. Retorno em relação apenas ao preço de compra.' },
        { metric: 'paybackYears', label: 'ROI — Tempo de Retorno (anos)', value: formatDecimal(row.paybackYears, 2), how: 'Total do investimento inicial ÷ fluxo de caixa líquido anual. Anos para o lucro pagar o investimento (payback).' },
        { metric: 'paybackMonths', label: 'ROI — Tempo de Retorno (meses)', value: formatDecimal(row.paybackMonths, 0), how: 'Tempo de retorno em anos × 12.' },
      ],
    },
  ];

  return (
    <section className="rounded-xl border border-ui-border-soft bg-surface p-4" aria-label={`Como o ROI de ${row.propertyTitle} é calculado`}>
      <h2 className="text-sm font-semibold text-content">Como o ROI é calculado — {row.propertyTitle}</h2>

      {row.warnings.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          {row.warnings.map((warning) => <li key={warning}>{ROI_WARNING_LABELS[warning]}</li>)}
        </ul>
      )}

      <div className="mt-3 grid grid-cols-1 xl:grid-cols-2 gap-4">
        {blocks.map((block) => (
          <div key={block.title} className="overflow-hidden rounded-lg border border-ui-border-soft">
            <h3 className="bg-surface-subtle px-3 py-2 text-xs font-semibold uppercase tracking-wide text-content-secondary">{block.title}</h3>
            <table className="w-full text-sm text-content">
              <tbody>
                {block.lines.map((line) => (
                  <tr key={line.label} className={line.total ? 'bg-emerald-50 font-semibold dark:bg-emerald-950/30' : ''}>
                    <td className="border-t border-ui-border-soft p-2 align-top">
                      {line.label}
                      <p className="mt-0.5 text-[11px] font-normal text-content-muted">{line.how}</p>
                    </td>
                    <td className="border-t border-ui-border-soft p-2 text-right align-top whitespace-nowrap">
                      <button type="button" data-roi-metric={line.metric} aria-label={`Ver origem de ${line.label}`}
                        title="Ver origem do valor" onClick={() => onInspect(line.metric)}
                        className="rounded-sm underline decoration-dotted underline-offset-4 hover:text-brand focus-visible:outline-2 focus-visible:outline-brand">
                        {line.value}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] text-content-muted">
        Entram apenas lançamentos concluídos, pela data de efetivação, sem transferências. ROI anual = fluxo de caixa líquido anual ÷ total do investimento inicial × 100.
      </p>
    </section>
  );
}
