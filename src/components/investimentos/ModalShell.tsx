'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * Casca comum dos modais de Investimentos (título + fechar + rodapé).
 * Existe para os sete modais da tela não repetirem overlay, foco e rodapé —
 * e para que um ajuste de estilo valha para todos de uma vez.
 */

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Botões do rodapé. Sem rodapé quando ausente. */
  footer?: ReactNode;
  maxWidth?: string;
}

export const modalInputClass =
  'w-full border border-ui-border rounded-lg px-3 py-2 text-sm text-content bg-surface focus:outline-none focus:border-brand disabled:bg-surface-subtle disabled:text-content-muted';

export const modalLabelClass = 'block text-xs font-medium text-content-secondary mb-1';

export function ModalCancelButton({ onClick, children = 'Cancelar' }: { onClick: () => void; children?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-5 py-2 text-sm font-medium text-brand border border-brand rounded-lg hover:bg-brand/10 transition-colors"
    >
      {children}
    </button>
  );
}

export function ModalPrimaryButton({
  onClick,
  disabled,
  children,
  type = 'button',
}: {
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="px-5 py-2 text-sm font-medium text-white bg-brand rounded-lg hover:bg-brand-hover disabled:opacity-50 transition-colors"
    >
      {children}
    </button>
  );
}

export default function ModalShell({ title, onClose, children, footer, maxWidth = 'max-w-xl' }: Props) {
  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--color-overlay)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`bg-surface rounded-xl shadow-xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto p-6`}>
        <div className="flex items-start justify-between mb-5">
          <h2 className="text-base font-semibold text-content">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-content-muted hover:text-content transition-colors"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {children}

        {footer && <div className="mt-6 flex items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * Bloco cinza "Informações do Investimento" que abre os modais de saldo,
 * aporte e gestão de aportes — exatamente os quatro campos do layout.
 */
export function InvestmentInfoBox({
  product,
  productTypeLabel,
  issuer,
  institutionLabel,
}: {
  product: string;
  productTypeLabel: string;
  issuer: string;
  institutionLabel: string;
}) {
  const item = (label: string, value: string) => (
    <div>
      <p className="text-[11px] text-content-muted">{label}</p>
      <p className="text-sm text-content">{value || '---'}</p>
    </div>
  );

  return (
    <div className="mb-5">
      <p className="text-xs font-medium text-content-secondary mb-2">Informações do Investimento</p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg bg-surface-subtle p-4">
        {item('Produto', product)}
        {item('Tipo do Produto', productTypeLabel)}
        {item('Emissor', issuer)}
        {item('Inst. Financeira - Partição', institutionLabel)}
      </div>
    </div>
  );
}
