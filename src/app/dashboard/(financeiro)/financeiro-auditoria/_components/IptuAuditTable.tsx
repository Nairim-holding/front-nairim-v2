'use client';

import { Fragment, useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

import type { IptuAuditRow } from '@/core/entities/iptu-audit';
export type { IptuAuditRow } from '@/core/entities/iptu-audit';

interface IptuAuditTableProps {
  rows: IptuAuditRow[];
  totals: { income: number; expense: number; balance: number };
  isLoading: boolean;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateBr(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

/** Tabela de resultado da Auditoria de IPTU (Tarefa 3.1, Passos 4-5): Imóvel | Endereço | Receita | Despesa | Saldo, com linha "+" expansível mostrando os lançamentos. */
export default function IptuAuditTable({ rows, totals, isLoading }: IptuAuditTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return <div className="flex items-center justify-center py-16 text-content-muted text-sm">Carregando...</div>;
  }

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-content-muted text-sm text-center px-4">
        Nenhum lançamento de restituição ou pagamento de IPTU encontrado no período.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-ui-border-soft">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-surface-subtle text-content-secondary text-xs uppercase tracking-wide">
            <th className="w-10 px-3 py-2.5">Detalhe</th>
            <th className="text-left px-3 py-2.5">Nome Fantasia do Imóvel</th>
            <th className="text-left px-3 py-2.5">Endereço</th>
            <th className="text-right px-3 py-2.5">Receitas</th>
            <th className="text-right px-3 py-2.5">Despesas</th>
            <th className="text-right px-3 py-2.5">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isExpanded = expandedId === row.propertyId;
            return (
              <Fragment key={row.propertyId}>
                <tr
                  className="border-t border-ui-border-soft hover:bg-surface-subtle cursor-pointer transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : row.propertyId)}
                >
                  <td className="px-3 py-2.5 text-content-muted">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-content">{row.propertyTitle}</td>
                  <td className="px-3 py-2.5 text-content-secondary">{row.address ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right text-state-success font-medium">{formatCurrency(row.income)}</td>
                  <td className="px-3 py-2.5 text-right text-state-warning font-medium">{formatCurrency(row.expense)}</td>
                  <td className={`px-3 py-2.5 text-right font-semibold ${row.balance < 0 ? 'text-state-error' : 'text-content'}`}>
                    {formatCurrency(row.balance)}
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-surface-subtle/50">
                    <td colSpan={6} className="px-3 py-3">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="text-content-muted">
                            <th className="text-left px-2 py-1.5">Data</th>
                            <th className="text-left px-2 py-1.5">Descrição</th>
                            <th className="text-left px-2 py-1.5">Tipo</th>
                            <th className="text-right px-2 py-1.5">Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {row.transactions.map((t) => (
                            <tr key={t.id} className="border-t border-ui-border-soft/60">
                              <td className="px-2 py-1.5">{formatDateBr(t.date)}</td>
                              <td className="px-2 py-1.5">{t.description}</td>
                              <td className="px-2 py-1.5">
                                <span className={t.type === 'INCOME' ? 'text-state-success' : 'text-state-warning'}>
                                  {t.type === 'INCOME' ? 'Receita' : 'Despesa'}
                                </span>
                              </td>
                              <td className="px-2 py-1.5 text-right">{formatCurrency(t.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-ui-border font-semibold bg-surface-subtle">
            <td className="px-3 py-2.5"></td>
            <td className="px-3 py-2.5" colSpan={2}>Totais</td>
            <td className="px-3 py-2.5 text-right text-state-success">{formatCurrency(totals.income)}</td>
            <td className="px-3 py-2.5 text-right text-state-warning">{formatCurrency(totals.expense)}</td>
            <td className={`px-3 py-2.5 text-right ${totals.balance < 0 ? 'text-state-error' : 'text-content'}`}>
              {formatCurrency(totals.balance)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
