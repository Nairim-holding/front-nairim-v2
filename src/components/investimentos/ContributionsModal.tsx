'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useMessageContext, usePopupContext } from '@/contexts';
import {
  deleteInvestmentTransactionAction,
  listInvestmentTransactionsAction,
} from '@/server/actions/investment';
import { INVESTMENT_PRODUCT_TYPE_LABELS } from '@/shared/utils/investment-product-types';
import ModalShell, { InvestmentInfoBox, modalInputClass, modalLabelClass } from './ModalShell';
import ContributionFormModal from './ContributionFormModal';
import { MONTH_NAMES_FULL, formatAmount, formatDateBR } from './format';
import type { InvestmentRow, InvestmentTransactionEntry } from './types';

/**
 * Modal "Gerenciar Aportes e Resgates".
 *
 * Mostra os lançamentos de um mês (o da célula clicada), com troca de
 * mês/ano sem fechar o modal, e abre o formulário de aporte para editar.
 */

interface Props {
  investment: InvestmentRow;
  year: number;
  month: number;
  onClose: () => void;
  /** Chamado quando algo mudou — a grid precisa recarregar. */
  onChanged: () => void;
}

const TYPE_LABELS: Record<InvestmentTransactionEntry['type'], string> = {
  CONTRIBUTION: 'Aporte',
  REDEMPTION: 'Resgate',
};

export default function ContributionsModal({ investment, year, month, onClose, onChanged }: Props) {
  const { showMessage } = useMessageContext();
  const { showPopup } = usePopupContext();

  const [selectedMonth, setSelectedMonth] = useState(month);
  const [selectedYear, setSelectedYear] = useState(year);
  const [transactions, setTransactions] = useState<InvestmentTransactionEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editing, setEditing] = useState<InvestmentTransactionEntry | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  /** Data sugerida ao registrar: 1º dia do mês que está sendo visto. */
  const defaultDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;

  const years = useMemo(() => {
    const first = Number(investment.application_date.slice(0, 4));
    const last = Math.max(new Date().getFullYear(), year) + 1;
    return Array.from({ length: last - first + 1 }, (_, index) => first + index);
  }, [investment.application_date, year]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await listInvestmentTransactionsAction({
        investment_id: investment.id,
        year: selectedYear,
        month: selectedMonth,
      });
      if (!result.ok) throw new Error(result.error);
      setTransactions(result.data);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Erro ao carregar os aportes', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [investment.id, selectedMonth, selectedYear, showMessage]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = useCallback(
    (entry: InvestmentTransactionEntry) => {
      showPopup(
        'Excluir Lançamento',
        `Tem certeza que deseja excluir o ${TYPE_LABELS[entry.type].toLowerCase()} de ${formatDateBR(entry.date)} no valor de R$ ${formatAmount(entry.amount)}?`,
        async () => {
          const result = await deleteInvestmentTransactionAction(entry.id);
          if (!result.ok) {
            showMessage(result.error ?? 'Erro ao excluir o lançamento', 'error');
            return;
          }
          showMessage('Lançamento excluído com sucesso', 'success');
          onChanged();
          load();
        },
        () => {},
      );
    },
    [load, onChanged, showMessage, showPopup],
  );

  return (
    <>
      <ModalShell title="Gerenciar Aportes e Resgates" onClose={onClose} maxWidth="max-w-lg">
        <InvestmentInfoBox
          product={investment.product}
          productTypeLabel={INVESTMENT_PRODUCT_TYPE_LABELS[investment.product_type]}
          issuer={investment.issuer}
          institutionLabel={investment.institution_label}
        />

        <div className="mb-1 flex items-center justify-between">
          <label className={modalLabelClass}>Selecione um lançamento para editar</label>
          {/* Sem esse atalho, um mês vazio seria um beco sem saída: o "+" da
              grid só existe na célula, e aqui o usuário já está no mês certo. */}
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1 text-[11px] font-medium text-white hover:bg-brand-hover transition-colors"
          >
            <Plus size={12} />
            Registrar aporte
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className={modalInputClass}
          >
            {MONTH_NAMES_FULL.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className={modalInputClass}
          >
            {years.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-lg border border-ui-border-soft overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ backgroundColor: '#0d9488' }}>
                <th className="px-3 py-2 text-[11px] font-semibold text-white text-left">DATA</th>
                <th className="px-3 py-2 text-[11px] font-semibold text-white text-left">TIPO</th>
                <th className="px-3 py-2 text-[11px] font-semibold text-white text-left">VALOR</th>
                <th className="px-3 py-2 text-[11px] font-semibold text-white text-center w-24">AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-xs text-content-muted">
                    Carregando…
                  </td>
                </tr>
              )}
              {!isLoading && transactions.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-xs text-content-muted">
                    Nenhum aporte registrado neste mês.
                    <button
                      type="button"
                      onClick={() => setIsCreating(true)}
                      className="mx-auto mt-3 flex items-center gap-1 rounded-lg border border-brand px-3 py-1.5 text-[11px] font-medium text-brand hover:bg-brand/10 transition-colors"
                    >
                      <Plus size={12} />
                      Registrar aporte
                    </button>
                  </td>
                </tr>
              )}
              {!isLoading &&
                transactions.map((entry) => (
                  <tr key={entry.id} className="border-b border-ui-border-soft last:border-b-0">
                    <td className="px-3 py-2 text-xs text-content">{formatDateBR(entry.date)}</td>
                    <td className="px-3 py-2 text-xs text-content">{TYPE_LABELS[entry.type]}</td>
                    <td className="px-3 py-2 text-xs text-content">R$ {formatAmount(entry.amount)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditing(entry)}
                          className="text-brand hover:opacity-70 transition-opacity"
                          title="Editar lançamento"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(entry)}
                          className="text-red-600 hover:opacity-70 transition-opacity"
                          title="Excluir lançamento"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </ModalShell>

      {(editing || isCreating) && (
        <ContributionFormModal
          investment={investment}
          defaultDate={editing?.date ?? defaultDate}
          transaction={editing}
          onClose={() => {
            setEditing(null);
            setIsCreating(false);
          }}
          onSaved={() => {
            setEditing(null);
            setIsCreating(false);
            onChanged();
            load();
          }}
        />
      )}
    </>
  );
}
