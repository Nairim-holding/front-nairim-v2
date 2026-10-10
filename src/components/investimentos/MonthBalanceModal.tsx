'use client';

import { useCallback, useState } from 'react';
import { useMessageContext, usePopupContext } from '@/contexts';
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
  isManual?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function MonthBalanceModal({
  investment,
  year,
  month,
  currentBalance,
  isManual = false,
  onClose,
  onSaved,
}: Props) {
  const { showMessage } = useMessageContext();
  const { showPopup } = usePopupContext();
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
          {isManual && <button type="button" disabled={isSaving} className="mr-auto rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600" onClick={() => showPopup('Excluir saldo informado', `Excluir o saldo de ${formatMonthShort(month, year)}? O mês voltará a usar o saldo anterior e os aportes.`, async () => {
            setIsSaving(true);
            try {
              const result = await setInvestmentMonthBalanceAction({ investment_id: investment.id, year, month, balance: null });
              if (!result.ok) throw new Error(result.error);
              showMessage('Saldo informado excluído.', 'success'); onSaved();
            } catch (error) { showMessage(error instanceof Error ? error.message : 'Erro ao excluir saldo.', 'error'); }
            finally { setIsSaving(false); }
          })}>Excluir saldo</button>}
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
        {isManual ? 'Este saldo foi informado neste mês. Você pode corrigi-lo ou excluí-lo.' : 'Este valor vem do saldo anterior e dos aportes. Salvar registra um saldo específico para este mês.'}
      </p>
    </ModalShell>
  );
}
