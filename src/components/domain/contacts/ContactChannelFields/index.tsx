'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Lista editável de valores extras de um contato — celulares, telefones fixos
 * ou e-mails (Etapa 3).
 *
 * O PRIMEIRO valor é o principal e mora nos campos `cellphone`/`phone`/`email`
 * do próprio Contact; os demais viram ContactChannel. Quem decide isso é o
 * chamador: aqui a lista é só um array de strings, com "+" para acrescentar e
 * lixeira para remover, e sempre pelo menos uma linha visível (mesmo vazia)
 * para o formulário não parecer que perdeu o campo.
 */

interface ContactChannelFieldsProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  /** Máscara aplicada a cada valor digitado (telefones). */
  mask?: (value: string) => string;
  type?: 'text' | 'tel' | 'email';
  maxLength?: number;
  icon?: ReactNode;
  readOnly?: boolean;
  /** Rótulo do botão de adicionar, ex.: "Adicionar celular". */
  addLabel?: string;
}

export default function ContactChannelFields({
  label,
  values,
  onChange,
  placeholder,
  mask,
  type = 'text',
  maxLength,
  icon,
  readOnly = false,
  addLabel,
}: ContactChannelFieldsProps) {
  // Sempre renderiza ao menos um campo: uma lista vazia esconderia o input e
  // o usuário não teria onde clicar para começar.
  const rows = values.length > 0 ? values : [''];

  // O banco guarda telefone só com dígitos. Mascarar apenas no onChange
  // deixava o valor carregado cru até o usuário mexer no campo, então a
  // máscara é aplicada na exibição — vale para valor vindo da API e digitado.
  const display = (value: string) => (mask ? mask(value) : value);

  const updateAt = (index: number, raw: string) => {
    const next = [...rows];
    next[index] = mask ? mask(raw) : raw;
    onChange(next);
  };

  const removeAt = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    onChange(next);
  };

  const addRow = () => onChange([...rows, '']);

  return (
    <div>
      <label className="block text-sm font-medium text-content-secondary mb-1.5">
        <span className="inline-flex items-center gap-1.5">
          {icon}
          {label}
        </span>
      </label>

      <div className="space-y-2">
        {rows.map((value, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type={type}
              value={display(value)}
              onChange={(e) => updateAt(index, e.target.value)}
              disabled={readOnly}
              className="w-full p-3 border border-ui-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all disabled:bg-surface-muted disabled:cursor-not-allowed"
              placeholder={placeholder}
              maxLength={maxLength}
            />
            {!readOnly && rows.length > 1 && (
              <button
                type="button"
                onClick={() => removeAt(index)}
                aria-label={`Remover ${label.toLowerCase()} ${index + 1}`}
                title="Remover"
                className="shrink-0 p-2.5 text-content-muted hover:text-state-error hover:bg-state-error/10 rounded-lg transition-colors"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      {!readOnly && (
        <button
          type="button"
          onClick={addRow}
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-hover transition-colors"
        >
          <Plus size={15} />
          {addLabel ?? `Adicionar ${label.toLowerCase()}`}
        </button>
      )}
    </div>
  );
}
