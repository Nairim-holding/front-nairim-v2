/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface CloneUserGroupModalProps {
  /** Grupo de origem — suas diretivas serão copiadas para o novo grupo. */
  source: { id: string; description: string };
  onClose: () => void;
  /** Chamado após clonar com sucesso, com a mensagem retornada pela API. */
  onCloned: (message: string) => void;
}

/**
 * Sufixa a descrição do clone, seguindo a convenção que o sistema já usa em
 * lançamentos: clone de clone não empilha sufixo.
 */
function buildCloneDescription(description: string): string {
  const base = (description ?? '').trim();
  if (!base) return '';
  return base.endsWith('(cópia)') ? base : `${base} (cópia)`;
}

export default function CloneUserGroupModal({
  source,
  onClose,
  onCloned,
}: CloneUserGroupModalProps) {
  const [description, setDescription] = useState(() =>
    buildCloneDescription(source.description)
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Fecha no ESC — só quando não está gravando, para não abortar no meio
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, submitting]);

  const validate = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return 'Descrição é obrigatória';
    if (trimmed.length < 3) return 'Descrição deve ter no mínimo 3 caracteres';
    if (trimmed.length > 100) return 'Descrição deve ter no máximo 100 caracteres';
    return null;
  };

  const handleConfirm = async () => {
    const validationError = validate(description);
    if (validationError) {
      setError(validationError);
      inputRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_URL_API}/user-groups/${source.id}/clone`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: description.trim() }),
        }
      );

      const result = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 409) {
          setError('Já existe um grupo de usuário com essa descrição');
        } else {
          setError(result?.message || `Erro ${res.status} ao clonar o grupo`);
        }
        return;
      }

      onCloned(result?.message || 'Grupo clonado com sucesso!');
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Falha de conexão ao clonar o grupo');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4"
      onClick={() => !submitting && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="clone-group-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-surface rounded-lg shadow-2xl border border-ui-border font-poppins"
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-ui-border">
          <h2 id="clone-group-title" className="text-lg font-semibold text-content truncate">
            Clonar grupo usuário — {source.description}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            title="Fechar"
            className="p-1 rounded text-content-muted hover:text-content hover:bg-surface-subtle transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Corpo */}
        <div className="px-6 py-6">
          <p className="text-center text-2xl font-semibold text-state-error mb-2">
            Atenção!
          </p>
          <p className="text-center text-sm font-medium text-content-secondary mb-6">
            Ao confirmar a ação, serão clonadas TODAS as diretivas para um novo grupo.
          </p>

          <label
            htmlFor="clone-description"
            className="block text-sm font-medium text-content-secondary mb-1"
          >
            Nova Descrição <span className="text-state-error">*</span>
          </label>
          <input
            id="clone-description"
            ref={inputRef}
            type="text"
            value={description}
            maxLength={100}
            disabled={submitting}
            onChange={(e) => {
              setDescription(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirm();
            }}
            className={`w-full rounded-lg bg-card border px-4 py-2 text-[14px] text-content placeholder:text-content-placeholder focus:outline-none focus:ring-2 focus:ring-brand/50 disabled:opacity-60 ${
              error ? 'border-state-error' : 'border-ui-border'
            }`}
            placeholder="Descrição do novo grupo"
          />
          {error && <p className="text-state-error text-sm mt-1">{error}</p>}
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-ui-border">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-6 py-2.5 rounded-lg font-semibold text-sm text-white bg-state-error hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            CANCELAR
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="px-6 py-2.5 rounded-lg font-semibold text-sm text-white bg-[var(--color-brand-primary)] hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {submitting ? 'CLONANDO…' : 'CONFIRMAR'}
          </button>
        </div>
      </div>
    </div>
  );
}
