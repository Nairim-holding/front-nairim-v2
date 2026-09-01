'use client';

import { useCallback, useState } from 'react';
import { useMessageContext } from '@/contexts';
import {
  createInvestmentTransactionAction,
  setInvestmentMonthBalanceAction,
  updateInvestmentAction,
} from '@/server/actions/investment';
import { formatCurrencyRealtime } from '@/utils/masks';
import { parseCurrencyFromPTBR } from '@/utils/displayFormatters';
import { INVESTMENT_PRODUCT_TYPE_LABELS } from '@/shared/utils/investment-product-types';
import Checkbox from '@/components/ui/Checkbox';
import ModalShell, {
  InvestmentInfoBox,
  ModalCancelButton,
  ModalPrimaryButton,
  modalInputClass,
  modalLabelClass,
} from './ModalShell';
import type { InvestmentRow } from './types';

/**
 * Etapa 2 do fluxo "Resgate de Investimento" (layout aprovado pela print).
 *
 * Junta em uma única ação três operações que no resto da tela são separadas:
 * o lançamento de resgate (`InvestmentTransaction`), o saldo do mês
 * (`InvestmentMonthBalance`) e, se "Finalizado" marcado, a liquidação do
 * investimento (`Investment.liquidated_at`) — cada uma independente, sem
 * rollback entre si: se uma falhar, o usuário reabre o modal e tenta de novo.
 */

interface Props {
  investment: InvestmentRow;
  onClose: () => void;
  onSaved: () => void;
}

export default function RedemptionModal({ investment, onClose, onSaved }: Props) {
  const { showMessage } = useMessageContext();

  const [monthBalance, setMonthBalance] = useState('');
  const [netAmount, setNetAmount] = useState('');
  const [date, setDate] = useState('');
  const [finalized, setFinalized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    const balance = parseCurrencyFromPTBR(monthBalance);
    const amount = parseCurrencyFromPTBR(netAmount);

    if (balance < 0) return showMessage('Informe o saldo no mês do resgate', 'error');
    if (amount <= 0) return showMessage('Informe o valor líquido resgatado', 'error');
    if (!date) return showMessage('Informe a data do resgate', 'error');

    const [year, month] = date.slice(0, 7).split('-').map(Number);

    setIsSaving(true);
    try {
      const txResult = await createInvestmentTransactionAction({
        investment_id: investment.id,
        type: 'REDEMPTION',
        date,
        amount,
      });
      if (!txResult.ok) throw new Error(txResult.errors?.join('; ') || txResult.error);

      const balanceResult = await setInvestmentMonthBalanceAction({
        investment_id: investment.id,
        year,
        month,
        balance,
      });
      if (!balanceResult.ok) throw new Error(balanceResult.errors?.join('; ') || balanceResult.error);

      if (finalized) {
        const liquidateResult = await updateInvestmentAction(investment.id, { liquidated_at: date });
        if (!liquidateResult.ok) throw new Error(liquidateResult.errors?.join('; ') || liquidateResult.error);
      }

      showMessage('Resgate registrado com sucesso', 'success');
      onSaved();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Erro ao registrar o resgate', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [monthBalance, netAmount, date, finalized, investment.id, onSaved, showMessage]);

  return (
    <ModalShell
      title="Resgate de Investimento"
      onClose={onClose}
      maxWidth="max-w-lg"
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
            Saldo no mês do resgate <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={monthBalance}
            onChange={(e) => setMonthBalance(formatCurrencyRealtime(e.target.value))}
            placeholder="0,00"
            className={modalInputClass}
            autoFocus
          />
        </div>
        <div>
          <label className={modalLabelClass}>
            Valor líquido resgatado <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={netAmount}
            onChange={(e) => setNetAmount(formatCurrencyRealtime(e.target.value))}
            placeholder="0,00"
            className={modalInputClass}
          />
        </div>
      </div>

      <div className="mt-4 flex items-end gap-4">
        <div className="flex-1">
          <label className={modalLabelClass}>
            Data do resgate <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={modalInputClass}
          />
        </div>
        <div className="pb-2">
          <Checkbox checked={finalized} onChange={setFinalized} label="Finalizado (Resgate total)" />
        </div>
      </div>
    </ModalShell>
  );
}
