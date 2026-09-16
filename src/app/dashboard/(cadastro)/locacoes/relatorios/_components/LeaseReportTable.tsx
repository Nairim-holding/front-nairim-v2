'use client';

import { forwardRef } from 'react';
import { formatCPFCNPJ, formatCurrency } from '@/utils/formatters';
import type { LeaseReportResult } from '@/core/entities/lease-report';

/**
 * Tabela principal do Relatório de Locações — uma linha por locação, somada
 * sobre os meses de referência selecionados.
 *
 * A ordem e os rótulos das colunas seguem o documento do cliente. As colunas
 * de débito (Desconto/Despesa, Retenções, Parte da Imobiliária) saem em
 * laranja, mesmo padrão do Extrato dos Relatórios Financeiros, e são somadas
 * como positivas — o sinal está na fórmula do Valor Líquido, não no valor
 * exibido, igual à planilha que o relatório substitui.
 */

/** Colunas de valor, na ordem do documento do cliente. */
const CURRENCY_LABELS = [
  'Receita Bruta',
  'Valor Recebido',
  'Desconto / Despesa',
  'Multa',
  'IPTU',
  'Retenções',
  'Parte da Imobiliária',
  'Valor Líquido',
];

const CREDIT = 'text-emerald-600 dark:text-emerald-400';
const DEBIT = 'text-orange-600 dark:text-orange-400';
const NET = 'text-content font-semibold';

/** Permite quebrar antes do valor, mas mantém todos os dígitos juntos. */
function money(value: number) {
  const formatted = formatCurrency(value);
  const separator = formatted.search(/\s/);
  if (separator < 0) return <span className="whitespace-nowrap">{formatted}</span>;
  return <>{formatted.slice(0, separator)} <span className="inline-block whitespace-nowrap">{formatted.slice(separator + 1)}</span></>;
}

interface LeaseReportTableProps {
  data: LeaseReportResult;
}

const LeaseReportTable = forwardRef<HTMLTableElement, LeaseReportTableProps>(function LeaseReportTable({ data }, ref) {
  const { rows, totals } = data;

  return (
    <div className="overflow-x-auto">
      <table ref={ref} className="w-full min-w-[1000px] table-fixed border-collapse [&_th]:whitespace-normal [&_th]:break-normal [&_th]:px-1.5 [&_td]:whitespace-normal [&_td]:break-words [&_td]:px-1.5 [&_tbody_tr]:text-xs [&_tfoot_tr]:text-xs">
        <colgroup>
          <col style={{ width: '8%' }} />
          <col style={{ width: '12%' }} />
          {CURRENCY_LABELS.map((label) => <col key={label} style={{ width: '7.5%' }} />)}
          <col style={{ width: '12%' }} />
          <col style={{ width: '8%' }} />
        </colgroup>
        <thead>
          <tr className="text-left text-[10px] font-semibold text-content-muted uppercase border-b border-ui-border-soft">
            <th className="px-3 py-2 whitespace-nowrap">Imobiliária</th>
            <th className="px-3 py-2 whitespace-nowrap">Imóvel</th>
            {CURRENCY_LABELS.map((label) => (
              <th key={label} className="px-3 py-2 whitespace-nowrap text-right">{label}</th>
            ))}
            <th className="px-3 py-2 whitespace-nowrap">Locatário</th>
            <th className="px-3 py-2 whitespace-nowrap">CPF / CNPJ</th>
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={CURRENCY_LABELS.length + 4} className="px-3 py-8 text-center text-sm text-content-muted">
                Nenhuma locação com movimento no período selecionado.
              </td>
            </tr>
          )}

          {rows.map((row) => (
            <tr key={row.lease_id} className="text-sm text-content-secondary border-b border-ui-border-soft/60 hover:bg-surface-subtle">
              <td className="px-3 py-1.5 whitespace-nowrap">{row.agency_name}</td>
              <td className="px-3 py-1.5">
                {row.property_title}
                {/* Marca a linha que compõe o quadro de Retenções, senão não há
                    como conferir de onde saiu a base do IRRF. */}
                {row.has_withholding && (
                  <span className="ml-2 align-middle text-[9px] font-semibold uppercase tracking-wide text-brand border border-brand/30 rounded px-1 py-0.5">
                    IRRF
                  </span>
                )}
              </td>
              <td className={`px-3 py-1.5 text-right ${CREDIT}`}>{money(row.gross_revenue)}</td>
              <td className={`px-3 py-1.5 text-right ${CREDIT}`}>{money(row.received_amount)}</td>
              <td className={`px-3 py-1.5 text-right ${DEBIT}`}>{money(row.discount_expense)}</td>
              <td className={`px-3 py-1.5 text-right ${CREDIT}`}>{money(row.penalty)}</td>
              <td className={`px-3 py-1.5 text-right ${CREDIT}`}>{money(row.property_tax_refund)}</td>
              <td className={`px-3 py-1.5 text-right ${DEBIT}`}>{money(row.withholding)}</td>
              <td className={`px-3 py-1.5 text-right ${DEBIT}`}>{money(row.agency_share)}</td>
              <td className={`px-3 py-1.5 text-right ${NET}`}>{money(row.net_amount)}</td>
              <td className="px-3 py-1.5 whitespace-nowrap">{row.tenant_name}</td>
              <td className="px-3 py-1.5 whitespace-nowrap">{row.tenant_document ? formatCPFCNPJ(row.tenant_document) : '-'}</td>
            </tr>
          ))}
        </tbody>

        {rows.length > 0 && (
          <tfoot>
            <tr className="text-sm font-bold text-content border-t-2 border-ui-border">
              <td className="px-3 py-2" colSpan={2}>Total</td>
              <td className="px-3 py-2 text-right">{money(totals.gross_revenue)}</td>
              <td className="px-3 py-2 text-right">{money(totals.received_amount)}</td>
              <td className="px-3 py-2 text-right">{money(totals.discount_expense)}</td>
              <td className="px-3 py-2 text-right">{money(totals.penalty)}</td>
              <td className="px-3 py-2 text-right">{money(totals.property_tax_refund)}</td>
              <td className="px-3 py-2 text-right">{money(totals.withholding)}</td>
              <td className="px-3 py-2 text-right">{money(totals.agency_share)}</td>
              <td className="px-3 py-2 text-right">{money(totals.net_amount)}</td>
              <td className="px-3 py-2" colSpan={2} />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
});

export default LeaseReportTable;
