'use client';

import { useCallback, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { useMessageContext } from '@/contexts';
import { reorderInvestmentsAction } from '@/server/actions/investment';
import ModalShell, { ModalCancelButton, ModalPrimaryButton } from './ModalShell';
import { formatDateBR } from './format';
import type { InvestmentRow } from './types';

/**
 * Modal "Editar Ordem de Visualização dos Investimentos".
 *
 * Arrastar-e-soltar em HTML nativo (draggable + dragover) — o projeto não tem
 * biblioteca de DnD e a lista é curta o bastante para não justificar uma.
 * A ordem confirmada vira `display_order` e passa a reger a grid.
 */

interface Props {
  investments: InvestmentRow[];
  onClose: () => void;
  onSaved: () => void;
}

function describe(investment: InvestmentRow): string {
  const maturity = formatDateBR(investment.maturity_date);
  return [investment.institution_label, investment.issuer, investment.product, maturity]
    .filter(Boolean)
    .join(' | ');
}

export default function InvestmentOrderModal({ investments, onClose, onSaved }: Props) {
  const { showMessage } = useMessageContext();
  const [items, setItems] = useState(investments);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const moveItem = useCallback((from: number, to: number) => {
    setItems((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const result = await reorderInvestmentsAction({ ordered_ids: items.map((item) => item.id) });
      if (!result.ok) throw new Error(result.errors?.join('; ') || result.error);
      showMessage('Ordem de visualização atualizada', 'success');
      onSaved();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Erro ao salvar a ordem', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [items, onSaved, showMessage]);

  return (
    <ModalShell
      title="Editar Ordem de Visualização dos Investimentos"
      onClose={onClose}
      maxWidth="max-w-lg"
      footer={
        <>
          <ModalCancelButton onClick={onClose} />
          <ModalPrimaryButton onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Salvando…' : 'Ordenar'}
          </ModalPrimaryButton>
        </>
      }
    >
      <p className="text-xs text-content-muted mb-3">
        Arraste e solte os investimentos para alterar a ordem de visualização
      </p>

      <ul className="flex flex-col gap-2">
        {items.map((investment, index) => (
          <li
            key={investment.id}
            draggable
            onDragStart={() => setDraggingIndex(index)}
            onDragEnd={() => setDraggingIndex(null)}
            onDragOver={(e) => {
              e.preventDefault();
              if (draggingIndex === null || draggingIndex === index) return;
              moveItem(draggingIndex, index);
              setDraggingIndex(index);
            }}
            onDrop={(e) => e.preventDefault()}
            className={`flex items-center gap-2 rounded-lg border border-ui-border px-3 py-2.5 text-xs text-content bg-surface cursor-grab active:cursor-grabbing transition-opacity ${
              draggingIndex === index ? 'opacity-50' : ''
            }`}
          >
            <GripVertical size={14} className="shrink-0 text-content-muted" />
            <span className="leading-snug">{describe(investment)}</span>
          </li>
        ))}
      </ul>
    </ModalShell>
  );
}
