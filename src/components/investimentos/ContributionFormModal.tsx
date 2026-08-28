'use client';

import { useCallback, useState } from 'react';
import { useMessageContext } from '@/contexts';
import {
  createInvestmentTransactionAction,
  updateInvestmentTransactionAction,
} from '@/server/actions/investment';
import { formatCurrencyRealtime, maskMoney } from '@/utils/masks';
import { parseCurrencyFromPTBR } from '@/utils/displayFormatters';
import { INVESTMENT_PRODUCT_TYPE_LABELS } from '@/shared/utils/investment-product-types';
import ModalShell, {
  InvestmentInfoBox,
  ModalCancelButton,
  ModalPrimaryButton,
  modalInputClass,
  modalLabelClass,
} from './ModalShell';
import type { InvestmentRow, InvestmentTransactionEntry } from './types';

/**
 * Modal "Registrar Aporte" (e edição de um aporte já lançado).
 *
 * Aportes do mesmo mês somam na célula "Aplicado" — não há nada a fazer aqui
 * para isso: a grid soma as transações do mês.
 */

interface Props {
  investment: InvestmentRow;
  /** Data sugerida (1º dia do mês da célula clicada). */
  defaultDate: string;
  /** Presente = edição de um lançamento existente. */
  transaction?: InvestmentTransactionEntry | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function ContributionFormModal({
  investment,
  defaultDate,
  transaction,
  onClose,
  onSaved,
}: Props) {
  const { showMessage } = useMessageContext();
  const isEditing = !!transaction;

  const [amount, setAmount] = useState(() => (transaction ? maskMoney(transaction.amount) : ''));
  const [date, setDate] = useState(() => transaction?.date ?? defaultDate);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    const parsed = parseCurrencyFromPTBR(amount);
    if (parsed <= 0) return showMessage('Informe o valor do aporte', 'error');
    if (!date) return showMessage('Informe a data da aplicação', 'error');

    setIsSaving(true);
    try {
      const result = isEditing
        ? await updateInvestmentTransactionAction(transaction!.id, {
            type: transaction!.type,
            date,
            amount: parsed,
          })
        : await createInvestmentTransactionAction({
            investment_id: investment.id,
            type: 'CONTRIBUTION',
            date,
            amount: parsed,
          });
      if (!result.ok) throw new Error(result.errors?.join('; ') || result.error);
      showMessage(isEditing ? 'Aporte atualizado com sucesso' : 'Aporte registrado com sucesso', 'success');
      onSaved();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Erro ao salvar o aporte', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [amount, date, investment.id, isEditing, transaction, onSaved, showMessage]);

  return (
    <ModalShell
      title={isEditing ? 'Editar Aporte' : 'Registrar Aporte'}
      onClose={onClose}
      maxWidth="max-w-md"
      footer={
        <>
          <ModalCancelButton onClick={onClose} />
          <ModalPrimaryButton onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Salvando…' : 'Salvar'}
          </ModalPrimaryButton>
        </>
      }
    >
      <InvestmentInfoBox
        product={investment.product}
        productTypeLabel={INVESTMENT_PRODUCT_TYPE_LABELS[investment.product_type]}
        issuer={investment.issuer}
        institutionLabel={investment.institution_label}
      />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={modalLabelClass}>
            Valor <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(formatCurrencyRealtime(e.target.value))}
            placeholder="0,00"
            className={modalInputClass}
            autoFocus
          />
        </div>
        <div>
          <label className={modalLabelClass}>
            Data da aplicação <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={modalInputClass}
          />
        </div>
      </div>
    </ModalShell>
  );
}
