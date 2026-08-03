'use client';

interface AuditFooterProps {
  createdBy?: string | null;
  createdAt?: string | null;
  updatedBy?: string | null;
  updatedAt?: string | null;
}

function formatStamp(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Rodapé de auditoria: quem cadastrou e quem alterou o grupo por último. */
export default function AuditFooter({
  createdBy,
  createdAt,
  updatedBy,
  updatedAt,
}: AuditFooterProps) {
  const created = formatStamp(createdAt);
  const updated = formatStamp(updatedAt);

  if (!created && !updated) return null;

  return (
    <div className="col-span-full flex flex-wrap justify-between gap-2 pt-4 mt-2 border-t border-ui-border text-xs italic text-content-muted">
      {created && (
        <span>
          Criado por {createdBy || '—'} em {created}
        </span>
      )}
      {updated && (
        <span>
          Modificado por {updatedBy || '—'} em {updated}
        </span>
      )}
    </div>
  );
}
