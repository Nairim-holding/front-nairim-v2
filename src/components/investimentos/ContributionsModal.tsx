'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useMessageContext, usePopupContext } from '@/contexts';
import {
  deleteInvestmentTransactionAction,
  listInvestmentTransactionsAction,
} from '@/server/actions/investment';
import { INVESTMENT_PRODUCT_TYPE_LABELS } from '@/shared/utils/investment-product-types';
import Checkbox from '@/components/ui/Checkbox';
import ModalShell, { InvestmentInfoBox, modalInputClass, modalLabelClass } from './ModalShell';
import ContributionFormModal from './ContributionFormModal';
import { MONTH_NAMES_FULL, formatAmount, formatDateBR, formatMonthHeader } from './format';
import type { GridMonth, InvestmentRow, InvestmentTransactionEntry } from './types';
import Select from '@/components/ui/Select';

/**
 * Modal "Gerenciar Aportes e Resgates".
 *
 * Mostra os lançamentos de um mês, com troca de mês/ano sem fechar o modal, e
 * abre o formulário de aporte para editar.
 *
 * A seleção de meses é interna (lista de checkboxes ao lado do Select de
 * Ano) — não depende só de já vir marcada pela grid (prop `months`, usada
 * como valor inicial). Trocar de ano limpa a marcação: não mistura meses de
 * anos diferentes, mesma regra do resto do sistema. Com 2+ meses marcados, os
 * lançamentos de todos aparecem empilhados, um bloco por mês.
 */

interface Props {
  investment: InvestmentRow;
  year: number;
  month: number;
  /** Meses já marcados na grid antes de abrir (opcional) — vira o estado inicial. */
  months?: GridMonth[];
  onClose: () => void;
  /** Chamado quando algo mudou — a grid precisa recarregar. */
  onChanged: () => void;
}

const TYPE_LABELS: Record<InvestmentTransactionEntry['type'], string> = {
  CONTRIBUTION: 'Aporte',
  REDEMPTION: 'Resgate',
};

export default function ContributionsModal({ investment, year, month, months, onClose, onChanged }: Props) {
  const { showMessage } = useMessageContext();
  const { showPopup } = usePopupContext();

  const [selectedYear, setSelectedYear] = useState(months?.[0]?.year ?? year);
  // Meses marcados dentro do ano selecionado — sempre do mesmo ano.
  const [selectedMonths, setSelectedMonths] = useState<Set<number>>(
    () => new Set((months ?? [{ year, month }]).filter((m) => m.year === (months?.[0]?.year ?? year)).map((m) => m.month)),
  );
  const isMultiMonth = selectedMonths.size > 1;

  const [transactions, setTransactions] = useState<InvestmentTransactionEntry[]>([]);
  const [multiTransactions, setMultiTransactions] = useState<Map<string, InvestmentTransactionEntry[]>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [editing, setEditing] = useState<InvestmentTransactionEntry | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const sortedMonths = useMemo(() => [...selectedMonths].sort((a, b) => a - b), [selectedMonths]);

  const toggleMonth = useCallback((m: number) => {
    setSelectedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(m)) {
        // Sempre pelo menos 1 mês marcado — não dá pra desmarcar o último.
        if (next.size === 1) return next;
        next.delete(m);
      } else {
        next.add(m);
      }
      return next;
    });
  }, []);

  const handleYearChange = useCallback((newYear: number) => {
    setSelectedYear(newYear);
    // Troca de ano reinicia a seleção para o mesmo mês que já estava marcado
    // (não mistura meses de anos diferentes) — cai no mês corrente só se não
    // houvesse nenhum marcado ainda.
    setSelectedMonths((prev) => new Set([[...prev][0] ?? new Date().getMonth() + 1]));
  }, []);

  /**
   * Atalhos de seleção rápida. "Últimos N meses" conta a partir do mês atual
   * real, mas fica restrito ao ano em vista (`selectedYear`) — mesma regra
   * dos checkboxes, para não misturar dois anos numa seleção só. Em Fev/2026,
   * "últimos 6 meses" marca só Jan+Fev/2026 (o que existe naquele ano).
   */
  const applyQuickSelect = useCallback(
    (kind: 'current' | 'full-year' | 'last-3' | 'last-6') => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      if (kind === 'full-year') {
        setSelectedMonths(new Set(Array.from({ length: 12 }, (_, i) => i + 1)));
        return;
      }
      if (kind === 'current') {
        setSelectedYear(currentYear);
        setSelectedMonths(new Set([currentMonth]));
        return;
      }
      // last-3 / last-6: ano de referência é o corrente; dentro dele, do mês
      // atual pra trás, até onde o ano permitir.
      const span = kind === 'last-3' ? 3 : 6;
      setSelectedYear(currentYear);
      const startMonth = Math.max(1, currentMonth - span + 1);
      setSelectedMonths(new Set(Array.from({ length: currentMonth - startMonth + 1 }, (_, i) => startMonth + i)));
    },
    [],
  );

  /** Data sugerida ao registrar: 1º dia do primeiro mês marcado. */
  const defaultDate = `${selectedYear}-${String(sortedMonths[0]).padStart(2, '0')}-01`;

  const years = useMemo(() => {
    const first = Number(investment.application_date.slice(0, 4));
    const last = Math.max(new Date().getFullYear(), year) + 1;
    return Array.from({ length: last - first + 1 }, (_, index) => first + index);
  }, [investment.application_date, year]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isMultiMonth) {
        const results = await Promise.all(
          sortedMonths.map((m) =>
            listInvestmentTransactionsAction({ investment_id: investment.id, year: selectedYear, month: m }),
          ),
        );
        const next = new Map<string, InvestmentTransactionEntry[]>();
        results.forEach((result, index) => {
          const m = sortedMonths[index];
          const key = `${selectedYear}-${String(m).padStart(2, '0')}`;
          if (!result.ok) throw new Error(result.error);
          next.set(key, result.data);
        });
        setMultiTransactions(next);
      } else {
        const result = await listInvestmentTransactionsAction({
          investment_id: investment.id,
          year: selectedYear,
          month: sortedMonths[0],
        });
        if (!result.ok) throw new Error(result.error);
        setTransactions(result.data);
      }
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Erro ao carregar os aportes', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [investment.id, selectedYear, sortedMonths, isMultiMonth, showMessage]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = useCallback(
    (entry: InvestmentTransactionEntry) => {
      showPopup(
        'Excluir Lançamento',
        `Tem certeza que deseja excluir o ${TYPE_LABELS[entry.type].toLowerCase()} de ${formatDateBR(entry.date)} no valor de R$ ${formatAmount(entry.amount)}?`,
        async () => {
          const result = await deleteInvestmentTransactionAction(entry.id);
          if (!result.ok) {
            showMessage(result.error ?? 'Erro ao excluir o lançamento', 'error');
            return;
          }
          showMessage('Lançamento excluído com sucesso', 'success');
          onChanged();
          load();
        },
        () => {},
      );
    },
    [load, onChanged, showMessage, showPopup],
  );

  const renderTransactionsTable = (entries: InvestmentTransactionEntry[]) => (
    <div className="rounded-lg border border-ui-border-soft overflow-hidden">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr style={{ backgroundColor: '#0d9488' }}>
            <th className="px-3 py-2 text-[11px] font-semibold text-white text-left">DATA</th>
            <th className="px-3 py-2 text-[11px] font-semibold text-white text-left">TIPO</th>
            <th className="px-3 py-2 text-[11px] font-semibold text-white text-left">VALOR</th>
            <th className="px-3 py-2 text-[11px] font-semibold text-white text-center w-24">AÇÕES</th>
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr>
              <td colSpan={4} className="px-3 py-6 text-center text-xs text-content-muted">
                Carregando…
              </td>
            </tr>
          )}
          {!isLoading && entries.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-6 text-center text-xs text-content-muted">
                Nenhum aporte registrado neste mês.
                <button
                  type="button"
                  onClick={() => setIsCreating(true)}
                  className="mx-auto mt-3 flex items-center gap-1 rounded-lg border border-brand px-3 py-1.5 text-[11px] font-medium text-brand hover:bg-brand/10 transition-colors"
                >
                  <Plus size={12} />
                  Registrar aporte
                </button>
              </td>
            </tr>
          )}
          {!isLoading &&
            entries.map((entry) => (
              <tr key={entry.id} className="border-b border-ui-border-soft last:border-b-0">
                <td className="px-3 py-2 text-xs text-content">{formatDateBR(entry.date)}</td>
                <td className="px-3 py-2 text-xs text-content">{TYPE_LABELS[entry.type]}</td>
                <td className="px-3 py-2 text-xs text-content">R$ {formatAmount(entry.amount)}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing(entry)}
                      className="text-brand hover:opacity-70 transition-opacity"
                      title="Editar lançamento"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(entry)}
                      className="text-red-600 hover:opacity-70 transition-opacity"
                      title="Excluir lançamento"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <ModalShell title="Gerenciar Aportes e Resgates" onClose={onClose} maxWidth="max-w-4xl">
        <InvestmentInfoBox
          product={investment.product}
          productTypeLabel={INVESTMENT_PRODUCT_TYPE_LABELS[investment.product_type]}
          issuer={investment.issuer}
          institutionLabel={investment.institution_label}
        />

        <div className="mb-1 flex items-center justify-between">
          <label className={modalLabelClass}>Selecione um lançamento para editar</label>
          {/* Sem esse atalho, um mês vazio seria um beco sem saída: o "+" da
              grid só existe na célula, e aqui o usuário já está no mês certo. */}
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1 text-[11px] font-medium text-white hover:bg-brand-hover transition-colors"
          >
            <Plus size={12} />
            Registrar aporte
          </button>
        </div>
        <div className="mb-4">
          {/* Ano + atalhos de seleção rápida numa linha só — o modal agora tem
              largura de sobra (max-w-2xl) pra isso não precisar empilhar. */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-[140px] shrink-0">
              <label className={modalLabelClass}>Ano</label>
              <Select
                value={selectedYear}
                onChange={(value) => handleYearChange(Number(value))}
                options={years.map((value) => ({ label: String(value), value }))}
                full
              />
            </div>
            <div className="flex flex-1 flex-wrap items-center gap-1.5 pb-0.5">
              <button
                type="button"
                onClick={() => applyQuickSelect('current')}
                className="rounded-md border border-ui-border px-2.5 py-1.5 text-[11px] text-content-secondary hover:bg-surface-subtle transition-colors"
              >
                Mês atual
              </button>
              <button
                type="button"
                onClick={() => applyQuickSelect('last-3')}
                className="rounded-md border border-ui-border px-2.5 py-1.5 text-[11px] text-content-secondary hover:bg-surface-subtle transition-colors"
              >
                Últimos 3 meses
              </button>
              <button
                type="button"
                onClick={() => applyQuickSelect('last-6')}
                className="rounded-md border border-ui-border px-2.5 py-1.5 text-[11px] text-content-secondary hover:bg-surface-subtle transition-colors"
              >
                Últimos 6 meses
              </button>
              <button
                type="button"
                onClick={() => applyQuickSelect('full-year')}
                className="rounded-md border border-ui-border px-2.5 py-1.5 text-[11px] text-content-secondary hover:bg-surface-subtle transition-colors"
              >
                Ano inteiro
              </button>
            </div>
          </div>

          {/* Marcar mais de um mês empilha os lançamentos abaixo, um bloco por
              mês — sem precisar reabrir o modal a cada troca. */}
          <label className={`${modalLabelClass} mt-3 mb-1.5 block`}>Meses</label>
          {/* Rótulo próprio em vez da prop `label` do Checkbox: em 6 colunas o
              `gap-3`/14px fixos do componente compartilhado apertariam demais
              os nomes longos (Setembro, Novembro, Dezembro). */}
          <div className="grid grid-cols-6 gap-x-2 gap-y-2 rounded-lg border border-ui-border-soft p-3">
            {MONTH_NAMES_FULL.map((name, index) => {
              const m = index + 1;
              return (
                <div key={m} className="flex items-center gap-1.5">
                  <Checkbox
                    checked={selectedMonths.has(m)}
                    onChange={() => toggleMonth(m)}
                    ariaLabel={name}
                    className="!w-4 !h-4"
                  />
                  {/* O Checkbox é um <button>, não um <input> — um <label> em
                      volta não o alterna sozinho, então o clique no texto é
                      tratado aqui. */}
                  <span
                    onClick={() => toggleMonth(m)}
                    className="cursor-pointer select-none text-[12px] font-medium text-content-secondary"
                  >
                    {name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {isMultiMonth ? (
          <div className="flex flex-col gap-4">
            {sortedMonths.map((m) => {
              const key = `${selectedYear}-${String(m).padStart(2, '0')}`;
              return (
                <div key={key}>
                  <p className="mb-1.5 text-xs font-semibold text-content-secondary">
                    {formatMonthHeader(m, selectedYear)}
                  </p>
                  {renderTransactionsTable(multiTransactions.get(key) ?? [])}
                </div>
              );
            })}
          </div>
        ) : (
          renderTransactionsTable(transactions)
        )}
      </ModalShell>

      {(editing || isCreating) && (
        <ContributionFormModal
          investment={investment}
          defaultDate={editing?.date ?? defaultDate}
          transaction={editing}
          onClose={() => {
            setEditing(null);
            setIsCreating(false);
          }}
          onSaved={() => {
            setEditing(null);
            setIsCreating(false);
            onChanged();
            load();
          }}
        />
      )}
    </>
  );
}
