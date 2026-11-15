'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Valores do período e dos filtros aplicados na grid. Transferências
 * compõem apenas o saldo acumulado das contas.
 */
export interface SummaryData {
  /** Receitas (créditos) com status Pendente. */
  receitasPrevisto: number;
  /** Receitas (créditos) com status Concluído. */
  receitasRecebido: number;
  /** Despesas (débitos) com status Pendente. */
  despesasPrevisto: number;
  /** Despesas (débitos) com status Concluído. */
  despesasPago: number;
  /** Saldo acumulado das contas no período/filtros (inclui transferências). */
  saldoContas: number;
}

interface Props {
  /** Início do período exibido na grid (YYYY-MM-DD). */
  from?: string;
  /** Fim do período exibido na grid (YYYY-MM-DD). */
  to?: string;
  /** Valores agregados da consulta de lançamentos. */
  summary?: SummaryData | null;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

/** dd/mm/aaaa a partir de "YYYY-MM-DD" sem fuso horário. */
const formatDateBR = (value?: string) => {
  if (!value) return '--/--/----';
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return '--/--/----';
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
};

function ValueRow({
  label,
  value,
  tone = 'neutral',
  strong = false,
}: {
  label: string;
  value: number | null | undefined;
  tone?: 'neutral' | 'income' | 'expense' | 'auto';
  strong?: boolean;
}) {
  let colorClass = 'text-content';
  if (value != null) {
    if (tone === 'income') colorClass = 'text-green-600';
    else if (tone === 'expense') colorClass = 'text-red-600';
    else if (tone === 'auto') colorClass = value >= 0 ? 'text-green-600' : 'text-red-600';
  }

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[12px] text-content-secondary">{label}</span>
      <span className={`text-[13px] tabular-nums ${strong ? 'font-semibold' : 'font-medium'} ${colorClass}`}>
        {value == null ? '—' : formatCurrency(value)}
      </span>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-ui-border-soft bg-surface-subtle px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-content-muted mb-1">{title}</p>
      {children}
    </div>
  );
}

/**
 * Painel lateral retrátil de "Resumo" para a tela de Lançamentos.
 * Somente leitura — não cria nem altera lançamentos. Os valores respeitam
 * exatamente o período e os filtros aplicados na grid.
 */
export default function SummaryPanel({ from, to, summary }: Props) {
  const [open, setOpen] = useState(false);

  const s = summary ?? null;
  const totalReceber = s ? s.receitasPrevisto + s.receitasRecebido : null;
  const totalPagar = s ? s.despesasPrevisto + s.despesasPago : null;
  const resumoPrevisto = totalReceber != null && totalPagar != null ? totalReceber - totalPagar : null;
  const saldoContas = s?.saldoContas ?? null;
  const previsaoFechamento = saldoContas != null && resumoPrevisto != null ? saldoContas + resumoPrevisto : null;

  return (
    <>
      {/* Aba recolhível na borda direita, à altura do título (visível quando o painel está fechado). */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir Resumo"
          className="fixed right-0 top-4 z-40 flex items-center rounded-l-md border border-r-0 border-ui-border-soft bg-surface px-1.5 py-1 shadow-sm hover:shadow-md hover:bg-surface-subtle transition-all hover:-translate-x-0.5"
          title="Resumo"
        >
          <ChevronLeft size={14} className="text-content-muted flex-shrink-0" />
        </button>
      )}

      {/* Drawer lateral. */}
      <div
        className={`fixed right-0 top-0 z-50 h-full w-[320px] max-w-[90vw] bg-surface-subtle border-l-2 border-brand shadow-2xl transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!open}
      >
        <div className="flex h-full flex-col">
          {/* Cabeçalho */}
          <div className="flex items-center justify-between border-b border-ui-border-soft px-3 py-3">
            <div>
              <p className="text-sm font-semibold text-content">Resultado previsto</p>
              <p className="text-[11px] text-content-muted">
                de: {formatDateBR(from)} até {formatDateBR(to)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Recolher Resumo"
              className="p-2 rounded-lg hover:bg-surface-subtle transition-colors -mr-1"
              title="Recolher painel"
            >
              <ChevronRight size={20} className="text-content-muted hover:text-content" />
            </button>
          </div>

          {/* Conteúdo */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {/* Bloco topo */}
            <div className="rounded-lg border border-ui-border-soft bg-surface px-3 py-2">
              <ValueRow label="Total a Receber" value={totalReceber} tone="income" />
              <ValueRow label="Total a Pagar" value={totalPagar} tone="expense" />
              <div className="my-1 border-t border-ui-border-soft" />
              <ValueRow label="Resumo Previsto" value={resumoPrevisto} tone="auto" strong />
            </div>

            {/* Bloco Receitas */}
            <Block title="Receitas">
              <ValueRow label="Previsto" value={totalReceber} tone="income" />
              <ValueRow label="Recebido" value={s?.receitasRecebido} tone="income" />
              <ValueRow label="Falta a Receber" value={s?.receitasPrevisto} tone="auto" />
            </Block>

            {/* Bloco Despesas */}
            <Block title="Despesas">
              <ValueRow label="Previsto" value={totalPagar} tone="expense" />
              <ValueRow label="Pago" value={s?.despesasPago} tone="expense" />
              <ValueRow label="Falta a Pagar" value={s?.despesasPrevisto} tone="auto" />
            </Block>

            {/* Bloco Resultado */}
            <Block title="Resultado">
              <ValueRow label="Saldo da(s) conta(s)" value={saldoContas} tone="auto" />
              <ValueRow label="Previsto Restante" value={resumoPrevisto} tone="auto" />
              <div className="my-1 border-t border-ui-border-soft" />
              <ValueRow label="Previsão de Fechamento" value={previsaoFechamento} tone="auto" strong />
            </Block>
          </div>
        </div>
      </div>
    </>
  );
}
