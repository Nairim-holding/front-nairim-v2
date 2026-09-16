'use client';

import { MessageCircle } from 'lucide-react';
import { type OverdueLease } from '@/core/entities/lease-overdue';
import { buildWhatsAppLink } from '@/core/entities/lease-overdue';

interface Props {
  item: OverdueLease;
  compact?: boolean;
}

export default function LeaseNotificationActions({ item, compact = false }: Props) {
  const whatsappLink = buildWhatsAppLink(item);
  const common = compact
    ? 'p-1.5 rounded-lg border transition-colors disabled:opacity-35 disabled:cursor-not-allowed'
    : 'inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-35 disabled:cursor-not-allowed';

  return (
    <div className="flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
      {whatsappLink ? (
        <a
          href={whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          title={`Abrir conversa com ${item.agency_phone}`}
          aria-label="Abrir cobrança manual no WhatsApp"
          className={`${common} border-green-200 text-green-700 bg-green-50 hover:bg-green-100 dark:bg-green-950/30 dark:border-green-900 dark:text-green-300`}
        >
          <MessageCircle size={compact ? 15 : 14} />
          {!compact && 'Abrir WhatsApp'}
        </a>
      ) : (
        <button
          type="button"
          disabled
          title="Selecione um número para alertas nos contatos da imobiliária"
          aria-label="WhatsApp sem número selecionado"
          className={`${common} border-ui-border-soft bg-surface-muted text-content-muted`}
        >
          <MessageCircle size={compact ? 15 : 14} />
          {!compact && 'Selecionar número'}
        </button>
      )}
    </div>
  );
}
