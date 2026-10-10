'use client';

import { Fragment, forwardRef, useImperativeHandle, useRef } from 'react';
import { Pencil, Plus, StickyNote } from 'lucide-react';
import Checkbox from '@/components/ui/Checkbox';
import HoverTooltip from './HoverTooltip';
import type { InvestmentDashboardResponse, InvestmentRow, MonthCellTarget } from './types';
import { formatCell, formatDateBR, formatMonthHeader, formatPercent } from './format';
import { INVESTMENT_COLUMNS } from './columns';

/**
 * Grid de "Meus Investimentos".
 *
 * Duas linhas por investimento — "Aplicado" (aportes do mês) e "Saldo Total"
 * (saldo informado/herdado) —, com as colunas de identificação em `rowSpan`.
 *
 * O cabeçalho fixo (Rendimento Mensal / Grau de Indep. Financeira / Saldo Dos
 * Investimentos / Valor Total Aplicado) vive dentro do `<thead>` de propósito:
 * é a única forma de os valores continuarem alinhados às colunas de mês
 * enquanto a tabela rola na horizontal. As colunas de identificação podem
 * ser exibidas e reordenadas, mantendo os indicadores alinhados aos meses.
 */

/** Alturas fixas para que os `top` do sticky sejam determinísticos. */
const STAT_ROW_H = 32;
const SPACER_H = 14;
/** `top` da linha de cabeçalho das colunas. */
const HEADER_TOP = STAT_ROW_H * 4 + SPACER_H - 5;

const TEAL = '#0d9488';

export interface InvestmentsTableHandle {
  getTableElement: () => HTMLTableElement | null;
}

interface Props {
  columns?: typeof INVESTMENT_COLUMNS;
  data: InvestmentDashboardResponse;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Duplo clique na linha / botão editar da barra. */
  onEditInvestment: (investment: InvestmentRow) => void;
  onEditNotes: (investment: InvestmentRow) => void;
  onEditBalance: (target: MonthCellTarget) => void;
  onAddContribution: (target: MonthCellTarget) => void;
  onManageContributions: (target: MonthCellTarget) => void;
  onEditIndependenceReference: () => void;
  /** Meses marcados para "Gerenciar selecionados" — sempre de um único investimento. */
  monthSelection: { investmentId: string; months: Set<string> } | null;
  onToggleMonthSelection: (investmentId: string, year: number, month: number) => void;
}

const statLabelStyle = { backgroundColor: TEAL };

const InvestmentsTable = forwardRef<InvestmentsTableHandle, Props>(function InvestmentsTable(
  {
    columns = INVESTMENT_COLUMNS,
    data,
    selectedId,
    onSelect,
    onEditInvestment,
    onEditNotes,
    onEditBalance,
    onAddContribution,
    onManageContributions,
    onEditIndependenceReference,
    monthSelection,
    onToggleMonthSelection,
  },
  ref,
) {
  const tableRef = useRef<HTMLTableElement>(null);
  useImperativeHandle(ref, () => ({ getTableElement: () => tableRef.current }), []);

  const { months, summary, investments } = data;
  const dataWidth = columns.reduce((sum, c) => sum + c.pixelWidth, 0);
  const widths = [36, ...columns.map(c => c.pixelWidth), Math.max(110, 220 - 36 - dataWidth)];
  const lefts = widths.map((_, index) => widths.slice(0, index).reduce((sum, width) => sum + width, 0));
  const fixedAreaWidth = widths.reduce((sum, width) => sum + width, 0);
  const metricIndex = widths.length - 1;

  /** Célula fixa (congelada à esquerda) com o offset já calculado. */
  const fixedCellStyle = (index: number, extra?: React.CSSProperties): React.CSSProperties => ({
    width: widths[index],
    minWidth: widths[index],
    maxWidth: widths[index],
    left: lefts[index],
    ...extra,
  });

  const renderStatRow = (
    key: string,
    label: string,
    top: number,
    values: string[],
    valueClass: string,
    labelExtra?: React.ReactNode,
  ) => (
    <tr key={key} style={{ height: STAT_ROW_H }}>
      <th
        colSpan={widths.length}
        className="sticky px-3 text-[11px] font-semibold text-white text-right whitespace-nowrap"
        style={{
          ...statLabelStyle,
          left: 0,
          top,
          width: fixedAreaWidth,
          minWidth: fixedAreaWidth,
          zIndex: 36,
        }}
      >
        <span className="flex items-center justify-end gap-1.5">
          {labelExtra}
          {label}
        </span>
      </th>
      {values.map((value, index) => (
        <th
          key={`${key}-${months[index].year}-${months[index].month}`}
          className={`bg-page sticky px-3 text-[11px] font-semibold text-right whitespace-nowrap border-l border-ui-border-soft ${valueClass}`}
          style={{ top, zIndex: 25 }}
        >
          {value}
        </th>
      ))}
    </tr>
  );

  const notesButton = (investment: InvestmentRow) => (
    <button
      type="button"
      onClick={() => onEditNotes(investment)}
      className={`p-1 rounded transition-colors ${
        investment.notes ? 'text-brand hover:opacity-70' : 'text-content-muted hover:text-content'
      }`}
      aria-label={investment.notes ? 'Editar observações' : 'Adicionar observações'}
    >
      <StickyNote size={14} />
    </button>
  );

  const renderRow = (investment: InvestmentRow) => {
    const isSelected = selectedId === investment.id;
    const rowTone = isSelected ? 'bg-brand/5' : '';

    return (
      <Fragment key={investment.id}>
        {/* Linha 1 — Aplicado. As colunas de identificação usam rowSpan={2}. */}
        <tr
          className={`border-t border-ui-border-soft ${rowTone}`}
          onDoubleClick={() => onEditInvestment(investment)}
        >
          <td
            rowSpan={2}
            className={`sticky z-10 px-0 text-center align-middle ${isSelected ? 'bg-brand/5' : 'bg-surface'}`}
            style={fixedCellStyle(0)}
          >
            <input
              type="radio"
              name="investment-selection"
              aria-label={`Selecionar ${investment.product}`}
              checked={isSelected}
              // Radio nativo não desmarca sozinho ao clicar no já marcado — o
              // toggle é feito aqui no click, antes do onChange do browser.
              onClick={() => onSelect(isSelected ? null : investment.id)}
              onChange={() => {}}
              className="w-3.5 h-3.5 accent-[color:var(--color-brand-primary)] cursor-pointer"
            />
          </td>
          {columns.map((column, index) => {
            const value = column.field === 'maturity_date'
              ? formatDateBR(investment.maturity_date) || '---'
              : String(investment[column.field as keyof InvestmentRow] ?? '');
            return (
              <td key={column.field} rowSpan={2}
                className={`sticky px-3 text-[11px] text-content align-middle truncate ${isSelected ? 'bg-brand/5' : 'bg-surface'}`}
                style={fixedCellStyle(index + 1, { zIndex: 10 - index })}
                title={column.field === 'notes' ? undefined : value}>
                {column.field === 'notes' ? (
                  <div className="flex items-center justify-center">
                    {investment.notes ? (
                      <HoverTooltip content={investment.notes} width={240}>{notesButton(investment)}</HoverTooltip>
                    ) : notesButton(investment)}
                  </div>
                ) : value}
              </td>
            );
          })}
          <td
            className="sticky z-[4] px-3 text-[10px] font-medium text-content-secondary text-right whitespace-nowrap bg-surface-subtle"
            style={fixedCellStyle(metricIndex)}
          >
            Aplicado
          </td>
          {investment.months.map((cell) => {
            const monthKey = `${cell.year}-${String(cell.month).padStart(2, '0')}`;
            const isMonthChecked =
              monthSelection?.investmentId === investment.id && monthSelection.months.has(monthKey);
            return (
            <td
              key={`applied-${cell.year}-${cell.month}`}
              className="group/cell relative border-l border-ui-border-soft px-3 py-1 text-[11px] text-right whitespace-nowrap text-content"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-brand-primary) 6%, transparent)' }}
            >
              {/* Marcar o mês para "Gerenciar selecionados" (item 4) — sempre
                  visível (não só no hover), senão fica escondido demais para
                  o usuário descobrir que dá para marcar vários meses. */}
              <span className="absolute inset-y-0 left-1 flex items-center">
                <Checkbox
                  checked={isMonthChecked}
                  onChange={() => onToggleMonthSelection(investment.id, cell.year, cell.month)}
                  ariaLabel={`Selecionar ${formatMonthHeader(cell.month, cell.year)}`}
                  className="!w-3.5 !h-3.5"
                />
              </span>
              <span className="pl-4">{formatCell(cell.applied)}</span>
              {/* Aporte novo (+) e gestão dos aportes do mês (lápis). */}
              <span className="absolute inset-y-0 right-1 hidden items-center gap-0.5 group-hover/cell:flex group-focus-within/cell:flex">
                <button
                  type="button"
                  onClick={() =>
                    onManageContributions({ investmentId: investment.id, year: cell.year, month: cell.month })
                  }
                  className="rounded bg-content/80 p-1 text-content-inverse hover:bg-brand"
                  title="Gerenciar aportes e resgates"
                >
                  <Pencil size={11} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onAddContribution({ investmentId: investment.id, year: cell.year, month: cell.month })
                  }
                  className="rounded bg-brand p-1 text-white hover:bg-brand-hover"
                  title="Registrar aporte"
                >
                  <Plus size={11} />
                </button>
              </span>
            </td>
            );
          })}
        </tr>

        {/* Linha 2 — Saldo Total. */}
        <tr className={`border-b border-ui-border-soft ${rowTone}`}>
          <td
            className="sticky z-[4] px-3 text-[10px] font-medium text-content-secondary text-right whitespace-nowrap bg-surface-subtle"
            style={fixedCellStyle(metricIndex)}
          >
            Saldo Total
          </td>
          {investment.months.map((cell) => (
            <td
              key={`balance-${cell.year}-${cell.month}`}
              className={`group/cell relative border-l border-ui-border-soft pl-3 pr-14 py-1 text-[11px] text-right whitespace-nowrap ${
                isSelected ? 'bg-brand/5' : 'bg-surface'
              } ${cell.balance_is_manual ? 'text-content font-medium' : 'text-content-secondary'}`}
              title={cell.balance_is_manual ? 'Saldo informado' : 'Saldo herdado do mês anterior + aplicado'}
            >
              <span>{cell.balance === null ? '' : formatCell(cell.balance)}</span>
              <button
                type="button"
                onClick={() => onEditBalance({ investmentId: investment.id, year: cell.year, month: cell.month })}
                className="absolute inset-y-0 right-0 inline-flex items-center rounded px-1.5 text-[10px] font-medium bg-surface-subtle/80 text-content-secondary backdrop-blur-sm hover:bg-brand hover:text-white group-hover/cell:flex group-focus-within/cell:flex"
                title="Editar saldo do mês"
                aria-label={`Editar saldo ${formatMonthHeader(cell.month, cell.year)} de ${investment.product}`}
              >
                Editar
              </button>
            </td>
          ))}
        </tr>
      </Fragment>
    );
  };

  return (
    <table ref={tableRef} className="w-full border-collapse text-sm">
      <thead>
        {renderStatRow(
          'yield',
          'Rendimento Mensal',
          0,
          summary.map((s) => formatCell(s.yield_amount) || '0,00'),
          'text-teal-600',
        )}
        {renderStatRow(
          'independence',
          'Grau de Indep. Financeira',
          STAT_ROW_H - 1,
          summary.map((s) => formatPercent(s.independence_degree)),
          'text-content',
          <button
            type="button"
            onClick={onEditIndependenceReference}
            className="text-white/90 hover:text-white"
            title="Editar valor de referência da independência financeira"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>,
        )}
        {renderStatRow(
          'balance',
          'Saldo Dos Investimentos',
          STAT_ROW_H * 2 - 2,
          summary.map((s) => formatCell(s.total_balance) || '0,00'),
          'text-content',
        )}
        {renderStatRow(
          'applied',
          'Valor Total Aplicado',
          STAT_ROW_H * 3 - 3,
          summary.map((s) => formatCell(s.total_applied) || '0,00'),
          'text-content',
        )}

        <tr style={{ height: SPACER_H }}>
          <th
            colSpan={widths.length + months.length}
            className="bg-page sticky"
            style={{ top: STAT_ROW_H * 4 - 4, zIndex: 20 }}
          />
        </tr>

        <tr style={{ backgroundColor: TEAL }}>
          {['', ...columns.map(c => c.label), ''].map((label, index) => (
            <th
              key={`head-${index}`}
              className={`sticky px-3 py-2 text-[11px] font-semibold text-white whitespace-nowrap ${
                index === 4 ? 'text-center' : 'text-left'
              }`}
              style={{
                ...fixedCellStyle(index, { top: HEADER_TOP }),
                backgroundColor: TEAL,
                zIndex: 40 - index,
              }}
            >
              {label}
            </th>
          ))}
          {months.map(({ month, year }) => (
            <th
              key={`head-${year}-${month}`}
              className="sticky px-3 py-2 text-[11px] font-semibold text-white text-right whitespace-nowrap border-l border-white/20"
              style={{ top: HEADER_TOP, backgroundColor: TEAL, zIndex: 25 }}
            >
              {formatMonthHeader(month, year)}
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {investments.length === 0 ? (
          <tr>
            <td
              colSpan={widths.length + months.length}
              className="px-6 py-16 text-center text-sm text-content-muted"
            >
              Nenhum investimento cadastrado para o período selecionado.
            </td>
          </tr>
        ) : (
          investments.map(renderRow)
        )}
      </tbody>
    </table>
  );
});

export default InvestmentsTable;
