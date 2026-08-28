'use client';

import { useCallback, useState } from 'react';
import { useMessageContext } from '@/contexts';
import { setInvestmentMonthBalanceAction } from '@/server/actions/investment';
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
import { formatMonthShort } from './format';
import type { InvestmentRow } from './types';

/**
 * Modal "Editar Saldo do Mês" — o botão Editar que aparece ao passar o mouse
 * sobre a célula de Saldo Total.
 *
 * Limpar o campo apaga o saldo informado: o mês volta a herdar (saldo do mês
 * anterior + aplicado), que é o comportamento padrão da grid.
 */

interface Props {
  investment: InvestmentRow;
  year: number;
  month: number;
  /** Saldo atualmente exibido na célula (informado ou herdado). */
  currentBalance: number | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function MonthBalanceModal({
  investment,
  year,
  month,
  currentBalance,
  onClose,
  onSaved,
}: Props) {
  const { showMessage } = useMessageContext();
  const [value, setValue] = useState(() => (currentBalance != null ? maskMoney(currentBalance) : ''));
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    const balance = value.trim() ? parseCurrencyFromPTBR(value) : null;
    setIsSaving(true);
    try {
      const result = await setInvestmentMonthBalanceAction({
        investment_id: investment.id,
        year,
        month,
        balance,
      });
      if (!result.ok) throw new Error(result.errors?.join('; ') || result.error);
      showMessage('Saldo do mês salvo com sucesso', 'success');
      onSaved();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Erro ao salvar o saldo do mês', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [investment.id, year, month, value, onSaved, showMessage]);

  return (
    <ModalShell
      title={`Editar Saldo do Mês: ${formatMonthShort(month, year)}`}
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

      <label className={modalLabelClass}>
        Saldo do mês <span className="text-red-500">*</span>
      </label>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => setValue(formatCurrencyRealtime(e.target.value))}
        placeholder="0,00"
        className={modalInputClass}
        autoFocus
      />
      <p className="mt-2 text-[11px] text-content-muted">
        Deixe em branco para o mês voltar a herdar o saldo anterior somado ao valor aplicado.
      </p>
    </ModalShell>
  );
}
