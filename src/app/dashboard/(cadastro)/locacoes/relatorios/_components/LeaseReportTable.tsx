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

interface LeaseReportTableProps {
  data: LeaseReportResult;
}

const LeaseReportTable = forwardRef<HTMLTableElement, LeaseReportTableProps>(function LeaseReportTable({ data }, ref) {
  const { rows, totals } = data;

  return (
    <div className="overflow-x-auto">
      <table ref={ref} className="w-full min-w-[1200px] border-collapse">
        <thead>
          <tr className="text-left text-[11px] font-semibold text-content-muted uppercase tracking-wide border-b border-ui-border-soft">
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
              <td className={`px-3 py-1.5 text-right ${CREDIT}`}>{formatCurrency(row.gross_revenue)}</td>
              <td className={`px-3 py-1.5 text-right ${CREDIT}`}>{formatCurrency(row.received_amount)}</td>
              <td className={`px-3 py-1.5 text-right ${DEBIT}`}>{formatCurrency(row.discount_expense)}</td>
              <td className={`px-3 py-1.5 text-right ${CREDIT}`}>{formatCurrency(row.penalty)}</td>
              <td className={`px-3 py-1.5 text-right ${CREDIT}`}>{formatCurrency(row.property_tax_refund)}</td>
              <td className={`px-3 py-1.5 text-right ${DEBIT}`}>{formatCurrency(row.withholding)}</td>
              <td className={`px-3 py-1.5 text-right ${DEBIT}`}>{formatCurrency(row.agency_share)}</td>
              <td className={`px-3 py-1.5 text-right ${NET}`}>{formatCurrency(row.net_amount)}</td>
              <td className="px-3 py-1.5 whitespace-nowrap">{row.tenant_name}</td>
              <td className="px-3 py-1.5 whitespace-nowrap">{row.tenant_document ? formatCPFCNPJ(row.tenant_document) : '-'}</td>
            </tr>
          ))}
        </tbody>

        {rows.length > 0 && (
          <tfoot>
            <tr className="text-sm font-bold text-content border-t-2 border-ui-border">
              <td className="px-3 py-2" colSpan={2}>Total</td>
              <td className="px-3 py-2 text-right">{formatCurrency(totals.gross_revenue)}</td>
              <td className="px-3 py-2 text-right">{formatCurrency(totals.received_amount)}</td>
              <td className="px-3 py-2 text-right">{formatCurrency(totals.discount_expense)}</td>
              <td className="px-3 py-2 text-right">{formatCurrency(totals.penalty)}</td>
              <td className="px-3 py-2 text-right">{formatCurrency(totals.property_tax_refund)}</td>
              <td className="px-3 py-2 text-right">{formatCurrency(totals.withholding)}</td>
              <td className="px-3 py-2 text-right">{formatCurrency(totals.agency_share)}</td>
              <td className="px-3 py-2 text-right">{formatCurrency(totals.net_amount)}</td>
              <td className="px-3 py-2" colSpan={2} />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
});

export default LeaseReportTable;
