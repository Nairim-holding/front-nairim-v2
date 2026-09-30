import { formatCurrency } from '@/utils/formatters';
import {
  WITHHOLDING_RATES,
  WITHHOLDING_TOTAL_RATE,
  type InvestmentRedemptionRow,
  type LeaseReportResult,
  type WithholdingTax,
} from '@/core/entities/lease-report';
import { quarterLabel } from './referencePeriod';

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

const TAX_LABELS: Record<WithholdingTax, string> = { pis: 'PIS', cofins: 'COFINS', irpj: 'IRPI', csll: 'CSLL' };

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
  .lease-report-table td:nth-child(10), .lease-report-table td:nth-child(11) { text-align: left; }
  /* Colunas Receita Bruta, Valor Recebido e Parte da Imobiliária saem com
     fundo verde-claro no modelo impresso do cliente. Retenções fica branca
     (só o total da coluna, no rodapé, sai destacado). */
  .lease-report-table td:nth-child(3), .lease-report-table td:nth-child(4), .lease-report-table td:nth-child(9) {
    background: #e2efda !important;
  }
  .lease-report-table tfoot td:nth-child(3), .lease-report-table tfoot td:nth-child(4),
  .lease-report-table tfoot td:nth-child(8), .lease-report-table tfoot td:nth-child(9) {
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

/** Quadro 2 — DARF mensal (Faturamento de Aluguéis) + A Pagar com dedução da retenção. */
function monthlyDarfBlock(data: LeaseReportResult): string {
  const pis = data.monthlyDarf.filter((r) => r.tax === 'pis');
  const cofins = data.monthlyDarf.filter((r) => r.tax === 'cofins');
  const revenue = pis[0]?.revenue ?? cofins[0]?.revenue ?? 0;
  const totalDarf = data.monthlyDarf.reduce((sum, r) => sum + r.darf, 0);
  const totalPayable = data.monthlyDarf.reduce((sum, r) => sum + r.payable, 0);

  return `
    <div class="lrs-row">
      <div>
        <table>
          <caption class="lrs-block-title">FATURAMENTO ALUGUÉIS</caption>
          <thead><tr><th>IMPOSTOS MENSAL</th><th>PIS</th><th>COFINS</th></tr></thead>
          <tbody>
            <tr><td>DARF PIS MENSAL</td><td colspan="2" class="cell-green">${money(pis[0]?.darf ?? 0)}</td></tr>
            <tr><td>DARF COFINS MENSAL</td><td colspan="2" class="cell-green">${money(cofins[0]?.darf ?? 0)}</td></tr>
          </tbody>
        </table>
      </div>
      <div>
        <table>
          <caption class="lrs-block-title">IMPOSTOS A PAGAR C/ DEDUÇÃO DA RETENÇÃO</caption>
          <thead><tr><th>ALÍQUOTA</th><th>TOTAL</th></tr></thead>
          <tbody>
            <tr><td>Faturamento: ${money(revenue)}</td><td class="cell-green cell-total">${money(totalPayable)}</td></tr>
            <tr><td>DARF do mês</td><td>${money(totalDarf)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/** Quadro 3 — Resgate de Aplicações Financeiras + DARF trimestral. */
function quarterlyBlock(data: LeaseReportResult, redemptionRows: InvestmentRedemptionRow[]): string {
  const quarters = data.quarters;
  const totalPayable = data.quarterlyDarf.reduce((sum, r) => sum + r.payable, 0);

  const redemptionRowsHTML = quarters.map((q) => {
    const csll = redemptionRows.find((r) => r.reference.year === q.year && r.reference.quarter === q.quarter && r.tax === 'csll');
    return `
      <tr>
        <td>${esc(quarterLabel(q))}</td>
        <td>${money(csll?.income ?? 0)}</td>
        <td>${csll?.tax_withheld ? money(csll.tax_withheld) : '-'}</td>
      </tr>
    `;
  }).join('');

  const darfRowsHTML = data.quarterlyDarf.map((row) => `
    <tr>
      <td>DARF ${TAX_LABELS[row.tax]} TRIME.</td>
      <td class="cell-green cell-total">${money(row.payable)}</td>
    </tr>
  `).join('');

  return `
    <div class="lrs-row">
      <div>
        <table>
          <caption class="lrs-block-title">APLICAÇÕES FINANCEIRAS TRIMESTRAIS</caption>
          <thead><tr><th>PERÍODO</th><th>RENDIMENTO</th><th>IR RETIDO</th></tr></thead>
          <tbody>${redemptionRowsHTML}</tbody>
        </table>
      </div>
      <div>
        <table>
          <caption class="lrs-block-title">IMPOSTOS A PAGAR C/ APLICAÇÃO FINANCEIRA</caption>
          <thead><tr><th>DARF TRIMESTRAL</th><th>TOTAL</th></tr></thead>
          <tbody>
            ${darfRowsHTML}
            <tr><td class="cell-total">TOTAL</td><td class="cell-green cell-total">${money(totalPayable)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
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
