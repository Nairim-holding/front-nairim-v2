'use client';

import { useCallback, useState } from 'react';
import { useMessageContext } from '@/contexts';
import { updateInvestmentNotesAction } from '@/server/actions/investment';
import ModalShell, { ModalCancelButton, ModalPrimaryButton, modalInputClass, modalLabelClass } from './ModalShell';
import type { Investment } from './types';

/** Modal "Editar Observações" — aberto pelo ícone de nota na linha. */

interface Props {
  investment: Investment;
  onClose: () => void;
  onSaved: () => void;
}

export default function NotesModal({ investment, onClose, onSaved }: Props) {
  const { showMessage } = useMessageContext();
  const [notes, setNotes] = useState(investment.notes ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const result = await updateInvestmentNotesAction({ id: investment.id, notes });
      if (!result.ok) throw new Error(result.errors?.join('; ') || result.error);
      showMessage('Observações salvas com sucesso', 'success');
      onSaved();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Erro ao salvar as observações', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [investment.id, notes, onSaved, showMessage]);

  return (
    <ModalShell
      title="Editar Observações"
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
      <label className={modalLabelClass}>Observações</label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        className={`${modalInputClass} resize-y`}
        autoFocus
      />
    </ModalShell>
  );
}
