import { formatCurrency } from '@/utils/formatters';
import {
  WITHHOLDING_RATES,
  WITHHOLDING_TOTAL_RATE,
  type InvestmentRedemptionRow,
  type LeaseReportResult,
  type WithholdingTax,
} from '@/core/entities/lease-report';
import { monthShortLabel, quarterLabel } from './referencePeriod';

/**
 * HTML de impressão do Relatório de Locações, reproduzindo o modelo impresso
 * que o cliente já usa (planilha com fundo verde nas colunas de saldo,
 * grade preta e os 3 blocos fiscais lado a lado abaixo da tabela).
 *
 * Existe separado do `TaxPanels.tsx` porque o arranjo impresso não é apenas um
 * CSS diferente do grid de cards da tela — é OUTRA estrutura (quadros
 * agrupados de forma diferente, sem os cards arredondados). Tentar chegar lá
 * só com CSS sobre o DOM da tela não fecha; aqui o HTML já sai no formato
 * certo, direto de `LeaseReportResult`.
 *
 * Passado para `printReportElement` via `options.rawSummaryHTML` +
 * `options.extraStyles` (`exportHelpers.ts`); a tabela principal continua
 * vindo do DOM (`tableRef`), só ganha o CSS de planilha via `extraStyles`.
 */

const TAX_LABELS: Record<WithholdingTax, string> = { pis: 'PIS', cofins: 'COFINS', irpj: 'IRPJ', csll: 'CSLL' };

const percent = (rate: number) => `${(rate * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const money = (value: number) => formatCurrency(value);
const esc = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * CSS de planilha para a tabela principal — sobrescreve o CSS genérico de
 * exportHelpers.ts. Seguro sobrescrever regras "globais" (body, @page) aqui:
 * a janela de impressão é aberta com UM relatório por vez (blob novo a cada
 * clique em Imprimir), então isto nunca convive com o CSS do Financeiro.
 */
export const LEASE_REPORT_TABLE_STYLES = `
  @page { size: A4 landscape; margin: 10mm; }
  body { padding: 8px !important; font-size: 11px; }
  table.lease-report-table { font-size: 10px; border: 2px solid #000; }
  .lease-report-table th, .lease-report-table td { border: 1px solid #000 !important; padding: 4px 6px; }
  .lease-report-table th { background: #fff !important; color: #000; font-weight: 700; text-align: center; }
  .lease-report-table td { text-align: right; white-space: nowrap; }
  .lease-report-table td:nth-child(1), .lease-report-table td:nth-child(2),
  .lease-report-table td:nth-child(13), .lease-report-table td:nth-child(14) { text-align: left; }
  /* Colunas Receita Bruta, Valor Recebido e Parte da Imobiliária saem com
     fundo verde-claro no modelo impresso do cliente. Retenções fica branca
     (só o total da coluna, no rodapé, sai destacado). */
  .lease-report-table tbody td:nth-child(4), .lease-report-table tbody td:nth-child(5), .lease-report-table tbody td:nth-child(11) {
    background: #e2efda !important;
  }
  .lease-report-table tfoot td:nth-child(2), .lease-report-table tfoot td:nth-child(3),
  .lease-report-table tfoot td:nth-child(9), .lease-report-table tfoot td:nth-child(10) {
    background: #e2efda !important;
  }
  .lease-report-table tfoot td { font-weight: 700; border-top: 2px solid #000 !important; }

  .lease-report-summary { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }
  .lease-report-summary table { border-collapse: collapse; font-size: 10px; width: 100%; }
  .lease-report-summary th, .lease-report-summary td { border: 1px solid #000; padding: 3px 6px; }
  .lease-report-summary th { background: #fff; font-weight: 700; text-align: center; }
  .lease-report-summary td { text-align: right; white-space: nowrap; }
  .lease-report-summary td:first-child, .lease-report-summary th:first-child { text-align: left; }
  .lease-report-summary .cell-green { background: #e2efda; }
  .lease-report-summary .cell-total { font-weight: 700; }
  .lease-report-summary .lrs-row { display: flex; gap: 10px; align-items: flex-start; break-inside: avoid; page-break-inside: avoid; }
  .lease-report-summary .lrs-row > div { flex: 1; min-width: 0; }
  .lease-report-summary .lrs-block-title { text-align: center; font-weight: 700; font-size: 10px; margin-bottom: 2px; }
  .lease-report-summary table { break-inside: avoid; page-break-inside: avoid; }
`;

function taxHeaderRow(taxes: WithholdingTax[]): string {
  return `<th>IMPOSTOS</th>${taxes.map((t) => `<th>${TAX_LABELS[t]}</th>`).join('')}<th>TOTAL</th>`;
}

/** Quadro 1 — Retenções dos Aluguéis. */
function withholdingBlock(data: LeaseReportResult): string {
  const taxes = Object.keys(WITHHOLDING_RATES) as WithholdingTax[];
  return `
    <table>
      <caption class="lrs-block-title">RETENÇÕES ALUGUÉIS</caption>
      <thead><tr>${taxHeaderRow(taxes)}</tr></thead>
      <tbody>
        <tr>
          <td>%</td>
          ${taxes.map((t) => `<td>${percent(WITHHOLDING_RATES[t])}</td>`).join('')}
          <td class="cell-total">${percent(WITHHOLDING_TOTAL_RATE)}</td>
        </tr>
        <tr>
          <td>VALOR RETIDO</td>
          ${taxes.map((t) => `<td>${money(data.withholding.amounts[t])}</td>`).join('')}
          <td class="cell-total cell-green">${money(data.withholding.total)}</td>
        </tr>
      </tbody>
    </table>
  `;
}

/**
 * Quadro 2 — Faturamento de Aluguéis (DARF mensal): uma tabela por mês, com o
 * faturamento, a alíquota, o imposto mensal e o a pagar com dedução da retenção,
 * como na planilha do cliente.
 */
function monthlyDarfBlock(data: LeaseReportResult): string {
  const showMonth = data.months.length > 1;
  return data.months.map((reference) => {
    const rows = data.monthlyDarf.filter((r) => r.reference.year === reference.year && r.reference.month === reference.month);
    const revenue = rows[0]?.revenue ?? 0;
    return `
    <div class="lrs-row">
      <div>
        <table>
          <thead>
            <tr>
              <th>FATURAMENTO ALUGUÉIS${showMonth ? ` — ${esc(monthShortLabel(reference))}` : ''}</th>
              <th>${money(revenue)}</th>
              <th>IMPOSTOS MENSAL</th>
              <th>IMPOSTOS A PAGAR C/ DEDUÇÃO DA RETENÇÃO</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
            <tr>
              <td>DARF ${TAX_LABELS[row.tax]} MENSAL</td>
              <td>${percent(row.rate)}</td>
              <td class="cell-green">${money(row.darf)}</td>
              <td class="cell-green cell-total">${money(row.payable)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  }).join('');
}

/**
 * Quadro 3 — Aplicações Financeiras Trimestral (rendimento e IR retido digitados
 * na tela) e Faturamento Trimestral (DARF CSLL/IRPJ sobre o trimestre inteiro).
 * O a pagar do trimestre soma o imposto do rendimento resgatado e desconta a
 * retenção dos aluguéis.
 */
function quarterlyBlock(data: LeaseReportResult, redemptionRows: InvestmentRedemptionRow[]): string {
  const redemptionOf = (q: { year: number; quarter: number }, tax: 'csll' | 'irpj') =>
    redemptionRows.find((r) => r.reference.year === q.year && r.reference.quarter === q.quarter && r.tax === tax);

  const applications = data.quarters.map((q) => {
    const csll = redemptionOf(q, 'csll');
    const irpj = redemptionOf(q, 'irpj');
    return `
            <tr>
              <td>DARF CSLL TRIME.</td>
              <td rowspan="2">${esc(quarterLabel(q))}</td>
              <td rowspan="2">${money(csll?.income ?? 0)}</td>
              <td rowspan="2">${csll?.tax_withheld ? money(csll.tax_withheld) : '-'}</td>
              <td>${percent(csll?.rate ?? 0.09)}</td>
              <td class="cell-green cell-total">${money(csll?.payable ?? 0)}</td>
            </tr>
            <tr>
              <td>DARF IRPJ TRIME.</td>
              <td>${percent(irpj?.rate ?? 0.15)}</td>
              <td class="cell-green cell-total">${money(irpj?.payable ?? 0)}</td>
            </tr>`;
  }).join('');

  const revenueTables = data.quarters.map((q) => {
    const rows = data.quarterlyDarf.filter((r) => r.reference.year === q.year && r.reference.quarter === q.quarter);
    return `
    <div class="lrs-row">
      <div>
        <table>
          <thead>
            <tr>
              <th>FATURAMENTO TRIMESTRAL${data.quarters.length > 1 ? ` — ${esc(quarterLabel(q))}` : ''}</th>
              <th>${money(rows[0]?.revenue ?? 0)}</th>
              <th>IMPOSTOS TRIMESTRAL</th>
              <th>IMPOSTOS A PAGAR C/ APLICAÇÃO FINANCEIRA E RETENÇÃO</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
            <tr>
              <td>DARF ${TAX_LABELS[row.tax]} TRIME.</td>
              <td>${percent(row.rate)}</td>
              <td class="cell-green">${money(row.darf)}</td>
              <td class="cell-green cell-total">${money(row.payable + (redemptionOf(q, row.tax)?.payable ?? 0))}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  }).join('');

  return `
    <div class="lrs-row">
      <div>
        <table>
          <caption class="lrs-block-title">APLICAÇÕES FINANCEIRAS TRIMESTRAL</caption>
          <thead>
            <tr><th>DARF</th><th>PERÍODO</th><th>RENDIMENTO</th><th>IR RETIDO</th><th>ALÍQUOTA</th><th>TOTAL</th></tr>
          </thead>
          <tbody>${applications}</tbody>
        </table>
      </div>
    </div>
    ${revenueTables}
  `;
}

/** Monta o resumo fiscal completo (3 blocos), na ordem/posição do modelo impresso do cliente. */
export function buildLeaseReportSummaryHTML(data: LeaseReportResult, redemptionRows: InvestmentRedemptionRow[]): string {
  return `
    <div class="lease-report-summary">
      ${withholdingBlock(data)}
      ${monthlyDarfBlock(data)}
      ${quarterlyBlock(data, redemptionRows)}
    </div>
  `;
}
