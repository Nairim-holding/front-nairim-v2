'use client';

import { useState } from 'react';
import { ReceiptText } from 'lucide-react';
import LeaseFinancialHistoryModal from './index';

/**
 * Cartão com o botão "Histórico Financeiro", usado nas telas de edição e
 * visualização da locação. Guarda o próprio estado do modal para as páginas
 * (formulários por etapas) não precisarem controlá-lo.
 */
export default function LeaseFinancialHistoryButton({ leaseId }: { leaseId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-ui-border-soft bg-surface-subtle p-5">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-lg bg-brand/10 text-brand">
          <ReceiptText size={20} />
        </div>
        <div>
          <p className="text-[15px] font-semibold text-content">Histórico Financeiro</p>
          <p className="text-[13px] text-content-secondary">
            Todos os lançamentos do Financeiro ligados a este contrato, incluindo os cancelados.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-5 py-2 text-sm font-medium text-white bg-brand rounded-lg hover:bg-brand-hover transition-colors"
      >
        Ver Histórico Financeiro
      </button>

      {open && <LeaseFinancialHistoryModal leaseId={leaseId} onClose={() => setOpen(false)} />}
    </div>
  );
}
