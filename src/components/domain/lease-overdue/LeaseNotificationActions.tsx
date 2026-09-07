'use client';

import { LoaderCircle, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { type OverdueLease } from '@/core/entities/lease-overdue';
import { sendLeaseOverdueWhatsAppAction } from '@/server/actions/lease-overdue';
import { describeActionError } from '@/shared/actions/action-result';
import { useMessageContext } from '@/contexts';

interface Props {
  item: OverdueLease;
  compact?: boolean;
  onUpdated?: () => void | Promise<void>;
}

export default function LeaseNotificationActions({ item, compact = false, onUpdated }: Props) {
  const { showMessage } = useMessageContext();
  const [sending, setSending] = useState(false);

  const notify = async () => {
    if (!item.agency_phone) {
      showMessage('A imobiliária não possui telefone válido cadastrado.', 'error');
      return;
    }
    setSending(true);
    const result = await sendLeaseOverdueWhatsAppAction(item.transaction_id);
    setSending(false);
    if (!result.ok) {
      showMessage(describeActionError(result, 'Não foi possível enviar a cobrança.'), 'error');
      return;
    }
    showMessage('Cobrança enviada automaticamente pelo WhatsApp.', 'success');
    await onUpdated?.();
  };

  const common = compact
    ? 'p-1.5 rounded-lg border transition-colors disabled:opacity-35 disabled:cursor-not-allowed'
    : 'inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-35 disabled:cursor-not-allowed';

  return (
    <div className="flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        onClick={() => void notify()}
        disabled={!item.agency_phone || sending}
        title={item.agency_phone ? `Enviar cobrança para ${item.agency_phone}` : 'Telefone não cadastrado'}
        aria-label="Enviar cobrança automaticamente por WhatsApp"
        className={`${common} border-green-200 text-green-700 bg-green-50 hover:bg-green-100 dark:bg-green-950/30 dark:border-green-900 dark:text-green-300`}
      >
        {sending ? <LoaderCircle size={compact ? 15 : 14} className="animate-spin" /> : <MessageCircle size={compact ? 15 : 14} />}
        {!compact && (sending ? 'Enviando…' : 'Enviar WhatsApp')}
      </button>
    </div>
  );
}
