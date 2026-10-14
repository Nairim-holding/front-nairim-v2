'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FileSpreadsheet, Link2 } from 'lucide-react';
import ModalShell, { ModalCancelButton } from '@/components/investimentos/ModalShell';
import { useMessageContext } from '@/contexts/MessageContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import { getLeaseFinancialHistoryAction, linkTransactionsToLeaseAction } from '@/server/actions/lease';
import { exportTableToExcel } from '@/lib/reports/exportHelpers';
import { formatCurrency, formatDate } from '@/utils';
import type { LeaseFinancialHistory, LeaseHistorySituation } from '@/core/entities/lease-financial-history';

interface Props {
  leaseId: string;
  onClose: () => void;
}

const SITUATION_CLASSES: Record<LeaseHistorySituation, string> = {
  SETTLED: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
  PENDING: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
  OVERDUE: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300',
  CANCELED: 'border-ui-border bg-surface-subtle text-content-secondary',
};

const TOTAL_CARDS: Array<{ situation: LeaseHistorySituation; label: string }> = [
  { situation: 'SETTLED', label: 'Recebido' },
  { situation: 'PENDING', label: 'A vencer' },
  { situation: 'OVERDUE', label: 'Em atraso' },
  { situation: 'CANCELED', label: 'Cancelado (não recebido)' },
];

/**
 * Histórico Financeiro da locação: todos os lançamentos do contrato, com a
 * coluna "Cancelado" para os valores que deixaram de ser recebidos, e os
 * lançamentos do Financeiro ainda sem vínculo com o contrato.
 */
export default function LeaseFinancialHistoryModal({ leaseId, onClose }: Props) {
  const { showMessage } = useMessageContext();
  const { can } = usePermissions();
  const [history, setHistory] = useState<LeaseFinancialHistory | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [linking, setLinking] = useState(false);
  const tableRef = useRef<HTMLTableElement>(null);

  const load = useCallback(async () => {
    const result = await getLeaseFinancialHistoryAction(leaseId);
    if (!result.ok) {
      setError(result.error || 'Erro ao carregar o histórico financeiro.');
      return;
    }
    setError('');
    setHistory(result.data);
    setSelected([]);
  }, [leaseId]);

  useEffect(() => { void load(); }, [load]);

  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  const link = async () => {
    setLinking(true);
    try {
      const result = await linkTransactionsToLeaseAction(leaseId, selected);
      if (!result.ok) throw new Error(result.error || 'Erro ao vincular os lançamentos.');
      showMessage(`${result.data.linked} lançamento(s) vinculado(s) ao contrato.`, 'success');
      await load();
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Erro ao vincular os lançamentos.', 'error');
    } finally {
      setLinking(false);
    }
  };

  const exportExcel = async () => {
    try {
      await exportTableToExcel(tableRef.current, `historico-financeiro-${history?.lease.contract_number ?? leaseId}`.replace(/[\\/:*?"<>|]+/g, '-'), 'leases');
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Erro ao exportar.', 'error');
    }
  };

  const title = history ? `Histórico Financeiro — Contrato ${history.lease.contract_number}` : 'Histórico Financeiro';

  return (
    <ModalShell title={title} onClose={onClose} maxWidth="max-w-6xl" footer={<ModalCancelButton onClick={onClose}>Fechar</ModalCancelButton>}>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {!error && !history && (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
        </div>
      )}

      {history && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-sm text-content-secondary">
              {history.lease.property_title} · {history.lease.tenant_name}
              {history.lease.canceled && <span className="ml-2 rounded-full border border-ui-border px-2 py-0.5 text-xs">Contrato cancelado</span>}
            </p>
            {can('leases', 'export') && (
              <button
                type="button"
                onClick={() => void exportExcel()}
                disabled={!history.rows.length}
                title="Exportar para Excel"
                aria-label="Exportar para Excel"
                className="rounded-lg border border-ui-border p-2 text-content-muted hover:text-content disabled:opacity-50"
              >
                <FileSpreadsheet size={18} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {TOTAL_CARDS.map(({ situation, label }) => (
              <div key={situation} className="rounded-lg border border-ui-border-soft bg-surface-subtle p-3">
                <p className="text-[11px] text-content-muted">{label}</p>
                <p className="text-sm font-semibold text-content">{formatCurrency(history.totals[situation].amount)}</p>
                <p className="text-[11px] text-content-muted">{history.totals[situation].count} lançamento(s) de receita</p>
              </div>
            ))}
          </div>

          <div className="overflow-auto rounded-lg border border-ui-border-soft">
            <table ref={tableRef} className="w-full min-w-[900px] text-left text-sm text-content">
              <thead>
                <tr>
                  {['Parcela', 'Descrição', 'Tipo', 'Data do evento', 'Vencimento', 'Valor', 'Situação', 'Cancelado'].map((label) => (
                    <th key={label} className="border-b border-ui-border bg-surface-subtle p-2 text-xs font-semibold text-content-secondary">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.rows.map((row) => (
                  <tr key={row.id} className={row.canceled ? 'text-content-muted' : ''}>
                    <td className="border-b border-ui-border-soft p-2">{row.installment}</td>
                    <td className="border-b border-ui-border-soft p-2">{row.description}</td>
                    <td className="border-b border-ui-border-soft p-2">{row.type === 'INCOME' ? 'Receita' : 'Despesa'}</td>
                    <td className="border-b border-ui-border-soft p-2">{formatDate(row.eventDate)}</td>
                    <td className="border-b border-ui-border-soft p-2">{formatDate(row.dueDate)}</td>
                    <td className={`border-b border-ui-border-soft p-2 ${row.canceled ? 'line-through' : ''}`}>{formatCurrency(row.amount)}</td>
                    <td className="border-b border-ui-border-soft p-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${SITUATION_CLASSES[row.situation]}`}>{row.situationLabel}</span>
                    </td>
                    <td className="border-b border-ui-border-soft p-2">{row.canceled ? 'Sim' : 'Não'}</td>
                  </tr>
                ))}
                {!history.rows.length && (
                  <tr><td colSpan={8} className="p-6 text-center text-content-muted">Nenhum lançamento financeiro vinculado a este contrato.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {!!history.candidates.length && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <p className="font-medium">{history.candidates.length} lançamento(s) do Financeiro citam este contrato, mas não estão vinculados a ele</p>
              <p className="mt-1 text-xs">Sem o vínculo eles não entram neste histórico nem nos alertas de atraso da locação.</p>
              <ul className="mt-2 space-y-1">
                {history.candidates.map((candidate) => (
                  <li key={candidate.id}>
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selected.includes(candidate.id)}
                        onChange={() => toggle(candidate.id)}
                        disabled={!can('leases', 'edit') || linking}
                      />
                      <span>
                        {candidate.description} · {formatDate(candidate.dueDate)} · {formatCurrency(candidate.amount)} · {candidate.status === 'COMPLETED' ? 'Concluído' : 'Pendente'}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {can('leases', 'edit') && (
                <button
                  type="button"
                  onClick={() => void link()}
                  disabled={!selected.length || linking}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  <Link2 size={15} />
                  {linking ? 'Vinculando…' : 'Vincular ao contrato'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </ModalShell>
  );
}
