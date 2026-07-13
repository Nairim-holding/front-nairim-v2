'use client';

import { useMemo, useState } from 'react';
import Select from '@/components/ui/Select';

interface InstitutionOption {
  label: string;
  value: string;
}

interface CenterOption {
  label: string;
  value: string;
  type?: string;
}

interface Props {
  /** Instituição de origem (a que o usuário já escolheu no lançamento). */
  originId: string;
  /**
   * Tipo da categoria de origem: EXPENSE (Saída) → espelho é Entrada, pede
   * centro de Crédito (INCOME). INCOME (Entrada) → espelho é Saída, pede
   * centro de Débito (EXPENSE).
   */
  originType: 'INCOME' | 'EXPENSE';
  /** Lista completa de instituições financeiras. */
  institutions: InstitutionOption[];
  /** Lista completa de centros (filtrada conforme a direção do espelho). */
  centers: CenterOption[];
  /** Valor da transferência, só para exibição. */
  amount: number;
  /** Descrição do lançamento, só para exibição. */
  description: string;
  /** Resolve com o id da conta destino e o centro de receita escolhidos. */
  onConfirm: (destinationId: string, destinationCenterId: string) => void;
  /** Cancela a transferência. */
  onCancel: () => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

export default function TransferDestinationModal({
  originId,
  originType,
  institutions,
  centers,
  amount,
  description,
  onConfirm,
  onCancel,
}: Props) {
  const [destinationId, setDestinationId] = useState<string>('');
  const [destinationCenterId, setDestinationCenterId] = useState<string>('');

  const originName = useMemo(
    () => institutions.find(i => String(i.value) === String(originId))?.label ?? '—',
    [institutions, originId],
  );

  // A conta destino não pode ser a mesma da origem.
  const destinationOptions = useMemo(
    () => institutions.filter(i => String(i.value) !== String(originId)),
    [institutions, originId],
  );

  // Origem Saída (EXPENSE) → espelho é Entrada → centro de Crédito (INCOME).
  // Origem Entrada (INCOME) → espelho é Saída → centro de Débito (EXPENSE).
  const mirrorCenterType: 'INCOME' | 'EXPENSE' = originType === 'EXPENSE' ? 'INCOME' : 'EXPENSE';
  const isCredit = mirrorCenterType === 'INCOME';

  const centerOptions = useMemo(
    () => centers.filter(c => c.type === mirrorCenterType),
    [centers, mirrorCenterType],
  );

  const handleConfirm = () => {
    if (!destinationId || !destinationCenterId) return;
    onConfirm(destinationId, destinationCenterId);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'var(--color-overlay)' }}
      onMouseDown={e => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="bg-surface rounded-xl shadow-xl w-full max-w-md p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-lg font-semibold text-content">Transferência entre Contas</h2>
          <button
            onClick={onCancel}
            className="text-content-muted hover:text-content text-2xl leading-none ml-auto"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <div className="space-y-2 mb-5 text-sm">
          <div className="flex justify-between">
            <span className="text-content-muted">Conta de origem</span>
            <span className="font-medium text-content">{originName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-content-muted">Valor</span>
            <span className="font-medium text-content">{formatCurrency(amount)}</span>
          </div>
          {description ? (
            <div className="flex justify-between gap-4">
              <span className="text-content-muted">Descrição</span>
              <span className="font-medium text-content text-right truncate">{description}</span>
            </div>
          ) : null}
        </div>

        <div className="mb-6">
          <Select
            label="Conta de destino"
            required
            searchable
            placeholder="Selecione a conta destino..."
            options={destinationOptions}
            value={destinationId}
            onChange={v => setDestinationId(String(v))}
          />
          <p className="mt-2 text-xs text-content-muted">
            Será criado automaticamente o lançamento de entrada nessa conta.
          </p>
        </div>

        <div className="mb-6">
          <Select
            label={isCredit ? 'Centro de Receita (Crédito – destino)' : 'Centro de Despesa (Débito – destino)'}
            required
            searchable
            placeholder={isCredit ? 'Selecione o centro de receita...' : 'Selecione o centro de despesa...'}
            options={centerOptions}
            value={destinationCenterId}
            onChange={v => setDestinationCenterId(String(v))}
          />
          <p className="mt-2 text-xs text-content-muted">
            {isCredit
              ? 'Centro usado no lançamento de entrada — não é copiado da despesa de origem.'
              : 'Centro usado no lançamento de saída — não é copiado da receita de origem.'}
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-content-secondary bg-surface-subtle rounded-lg hover:bg-surface-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!destinationId || !destinationCenterId}
            className="px-5 py-2 text-sm font-medium text-white bg-brand rounded-lg hover:bg-brand-hover disabled:opacity-50 transition-colors"
          >
            Confirmar Transferência
          </button>
        </div>
      </div>
    </div>
  );
}
