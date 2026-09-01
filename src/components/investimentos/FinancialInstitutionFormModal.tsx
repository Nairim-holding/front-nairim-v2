'use client';

import { useCallback, useState } from 'react';
import { useMessageContext } from '@/contexts';
import { createFinancialInstitutionAction } from '@/server/actions/financial-institution';
import ModalShell, { ModalCancelButton, ModalPrimaryButton, modalInputClass, modalLabelClass } from './ModalShell';
import type { FinancialInstitution } from '@/core/entities/financial-institution';

/**
 * Cadastro completo de Instituição Financeira, aberto de dentro do modal de
 * Investimento quando o cadastro rápido (só nome) falha — em vez de deixar o
 * usuário travado num erro genérico, oferece o formulário completo (mesmos
 * campos da tela /dashboard/instituicoes-financeiras) para tentar de novo.
 */

interface Props {
  /** Nome já digitado no cadastro rápido, para não perder o que o usuário escreveu. */
  initialName?: string;
  onClose: () => void;
  onSaved: (institution: FinancialInstitution) => void;
}

export default function FinancialInstitutionFormModal({ initialName = '', onClose, onSaved }: Props) {
  const { showMessage } = useMessageContext();

  const [name, setName] = useState(initialName);
  const [bankNumber, setBankNumber] = useState('');
  const [agencyNumber, setAgencyNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!name.trim()) return showMessage('Informe o nome da instituição', 'error');

    setIsSaving(true);
    try {
      const result = await createFinancialInstitutionAction({
        name: name.trim(),
        bank_number: bankNumber.trim() || null,
        agency_number: agencyNumber.trim() || null,
        account_number: accountNumber.trim() || null,
      });
      if (!result.ok) throw new Error(result.errors?.join('; ') || result.error);
      showMessage('Instituição financeira cadastrada', 'success');
      onSaved(result.data);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Erro ao cadastrar a instituição financeira', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [name, bankNumber, agencyNumber, accountNumber, onSaved, showMessage]);

  return (
    <ModalShell
      title="Nova Instituição Financeira"
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
      <p className="mb-4 text-xs text-content-muted">
        Não foi possível cadastrar pelo modo rápido. Preencha os dados abaixo para tentar novamente.
      </p>

      <div>
        <label className={modalLabelClass}>
          Nome da Instituição <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={modalInputClass}
          placeholder="Banco ABC"
          autoFocus
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <label className={modalLabelClass}>Número do Banco</label>
          <input
            type="text"
            value={bankNumber}
            onChange={(e) => setBankNumber(e.target.value)}
            className={modalInputClass}
            placeholder="Ex: 341"
          />
        </div>
        <div>
          <label className={modalLabelClass}>Agência</label>
          <input
            type="text"
            value={agencyNumber}
            onChange={(e) => setAgencyNumber(e.target.value)}
            className={modalInputClass}
            placeholder="Ex: 1234-X"
          />
        </div>
      </div>

      <div className="mt-4">
        <label className={modalLabelClass}>Número da Conta</label>
        <input
          type="text"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)}
          className={modalInputClass}
          placeholder="Ex: 12345-6"
        />
      </div>
    </ModalShell>
  );
}
