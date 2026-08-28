'use client';

import { useCallback, useState } from 'react';
import { useMessageContext } from '@/contexts';
import { saveInvestmentSettingsAction } from '@/server/actions/investment';
import { formatCurrencyRealtime, maskMoney } from '@/utils/masks';
import { parseCurrencyFromPTBR } from '@/utils/displayFormatters';
import ModalShell, { ModalCancelButton, ModalPrimaryButton, modalInputClass, modalLabelClass } from './ModalShell';

/**
 * Modal "Editar Independência Financeira" (engrenagem do indicador).
 *
 * O valor gravado é o denominador do Grau de Indep. Financeira: quanto de
 * renda mensal o usuário considera suficiente para viver dos investimentos.
 * Em branco, a tela cai de volta nos gastos planejados do mês.
 */

interface Props {
  currentValue: number | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function IndependenceReferenceModal({ currentValue, onClose, onSaved }: Props) {
  const { showMessage } = useMessageContext();
  const [value, setValue] = useState(() => (currentValue != null ? maskMoney(currentValue) : ''));
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    const parsed = value.trim() ? parseCurrencyFromPTBR(value) : null;
    setIsSaving(true);
    try {
      const result = await saveInvestmentSettingsAction({ independence_reference_amount: parsed });
      if (!result.ok) throw new Error(result.errors?.join('; ') || result.error);
      showMessage('Valor de referência salvo com sucesso', 'success');
      onSaved();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Erro ao salvar o valor de referência', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [value, onSaved, showMessage]);

  return (
    <ModalShell
      title="Editar Independência Financeira"
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
      <label className={modalLabelClass}>Valor de referência</label>
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
        Renda mensal desejada. Sem valor informado, o indicador usa os gastos planejados do mês atual.
      </p>
    </ModalShell>
  );
}
