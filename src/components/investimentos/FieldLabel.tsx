'use client';

import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import HoverTooltip from './HoverTooltip';

/**
 * Rótulo de campo dos modais de Investimentos, com o balão de ajuda (ⓘ) do
 * layout.
 *
 * Não reaproveita `components/ui/Label` porque lá o slot de ícone (`svg`) vem
 * ANTES do texto, e no layout aprovado o ⓘ vem depois do rótulo e do
 * asterisco. O balão é próprio (e não `title=`) para o texto aparecer na hora,
 * formatado, como nas telas de referência — e via `HoverTooltip`, porque o
 * painel do modal rola em `overflow-y-auto` e recortaria um balão `absolute`.
 */

export const INVESTMENT_FIELD_HINTS = {
  issuer: 'É a entidade, como um governo, banco ou empresa, que emitiu o ativo.',
  productType:
    'É a categoria específica de um instrumento financeiro, como ações, fundos, renda fixa ou derivativos, com características e finalidades distintas.',
  product:
    'É o instrumento financeiro específico dentro de um tipo de produto, com características próprias, como uma ação individual (PETR4) ou um CDB com taxa de 120% do CDI.',
  applicationDate: 'Data em que foi feito o aporte.',
  maturityDate:
    'É a data definida em que o valor investido, junto com os rendimentos, deve ser devolvido ao investidor pelo emissor.',
  liquidityDays: 'Prazo, em dias corridos, para o valor ficar disponível ao ser resgatado.',
} as const;

interface Props {
  children: ReactNode;
  hint?: string;
  required?: boolean;
  /** Botão à direita do rótulo (ex.: o "+" de cadastro rápido). */
  action?: ReactNode;
}

export default function FieldLabel({ children, hint, required, action }: Props) {
  return (
    <span className="mb-1 flex items-center gap-1 text-xs font-medium text-content-secondary">
      {children}
      {required && <span className="text-red-500">*</span>}
      {hint && (
        <HoverTooltip content={hint}>
          <span className="cursor-help text-content-muted">
            <Info size={12} />
          </span>
        </HoverTooltip>
      )}
      {action}
    </span>
  );
}
