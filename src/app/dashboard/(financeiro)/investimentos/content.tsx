'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpDown,
  Calendar,
  FileSpreadsheet,
  FileText,
  Filter,
  Pencil,
  Plus,
  RefreshCw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Section from '@/components/layout/PageSection';
import CalendarPicker from '@/components/ui/CalendarPicker';
import DynamicFilterModal from '@/components/filters/DynamicFilterModal';
import { useDynamicFilters, type DynamicFiltersResponse } from '@/hooks/useDynamicFilters';
import { useMessageContext } from '@/contexts';
import { getInvestmentDashboardAction, getInvestmentFiltersAction } from '@/server/actions/investment';
import InvestmentsTable, {
  LEFT_PANEL_WIDTH,
  STATS_BLOCK_HEIGHT,
  type InvestmentsTableHandle,
} from '@/components/investimentos/InvestmentsTable';
import InvestmentFormModal from '@/components/investimentos/InvestmentFormModal';
import IndependenceReferenceModal from '@/components/investimentos/IndependenceReferenceModal';
import InvestmentOrderModal from '@/components/investimentos/InvestmentOrderModal';
import MonthBalanceModal from '@/components/investimentos/MonthBalanceModal';
import NotesModal from '@/components/investimentos/NotesModal';
import ContributionsModal from '@/components/investimentos/ContributionsModal';
import ContributionFormModal from '@/components/investimentos/ContributionFormModal';
import { formatCurrencyBRL, formatDateBR, getDefaultDateRange, toMonthOf } from '@/components/investimentos/format';
import type {
  InvestmentDashboardResponse,
  InvestmentRow,
  MonthCellTarget,
} from '@/components/investimentos/types';

/**
 * Tela "Meus Investimentos".
 *
 * O painel da esquerda (gastos planejados, período e barra de ícones) é
 * posicionado por cima das colunas congeladas do cabeçalho da grid — mesmo
 * arranjo da tela de Planejamento e Controle, que mantém o bloco de
 * indicadores fixo enquanto a tabela rola.
 */

type ModalState =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'edit'; investment: InvestmentRow }
  | { kind: 'notes'; investment: InvestmentRow }
  | { kind: 'balance'; target: MonthCellTarget }
  | { kind: 'contribution'; target: MonthCellTarget }
  | { kind: 'contributions'; target: MonthCellTarget }
  | { kind: 'order' }
  | { kind: 'independence' };

const iconButtonClass =
  'p-2 rounded-lg border border-ui-border text-content-muted hover:text-content hover:bg-surface-subtle disabled:opacity-50 transition-colors';

export default function InvestmentsPageContent() {
  const { showMessage } = useMessageContext();
  const defaults = useMemo(() => getDefaultDateRange(), []);

  const [dateRange, setDateRange] = useState(defaults);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [data, setData] = useState<InvestmentDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ kind: 'none' });

  const [appliedFilters, setAppliedFilters] = useState<Record<string, unknown>>({});
  const [isFilterVisible, setIsFilterVisible] = useState(false);

  const tableRef = useRef<InvestmentsTableHandle>(null);

  const filtersFetcher = useCallback(async (): Promise<DynamicFiltersResponse> => {
    const result = await getInvestmentFiltersAction();
    if (!result.ok) throw new Error(result.error ?? 'Erro ao carregar filtros.');
    const payload = result.data as unknown as Partial<DynamicFiltersResponse>;
    return {
      filters: (payload.filters ?? []).map((f) => ({ ...f, description: f.description ?? '' })),
      operators: payload.operators ?? {},
      defaultSort: payload.defaultSort ?? 'display_order:asc',
      searchFields: payload.searchFields ?? [],
    };
  }, []);

  const { filters: dynamicFilters } = useDynamicFilters('/investments/filters', appliedFilters, filtersFetcher);
  const activeFilterCount = Object.keys(appliedFilters).length;

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    try {
      // A grid é mensal; o filtro é por dia (mesmo CalendarPicker de
      // Planejamento) — o período vira a faixa de meses que o contém.
      const result = await getInvestmentDashboardAction({
        startMonth: toMonthOf(dateRange.from),
        endMonth: toMonthOf(dateRange.to),
        ...appliedFilters,
      });
      if (!result.ok) throw new Error(result.errors?.join('; ') || result.error);
      setData(result.data);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Erro ao carregar os investimentos', 'error');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange.from, dateRange.to, appliedFilters, showMessage]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (!isCalendarOpen) return;
    // O bloco de período é renderizado duas vezes (mobile e desktop), então a
    // detecção é pelo atributo e não por ref — uma ref só apontaria para uma
    // das instâncias e o popover não fecharia na outra.
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-investment-period]')) setIsCalendarOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCalendarOpen]);

  // `?? []` direto criaria um array novo a cada render e invalidaria os memos abaixo.
  const investments = useMemo(() => data?.investments ?? [], [data]);
  const selectedInvestment = useMemo(
    () => investments.find((item) => item.id === selectedId) ?? null,
    [investments, selectedId],
  );

  /** Resolve o investimento de um alvo de célula (modais de mês). */
  const investmentOf = useCallback(
    (target: MonthCellTarget) => investments.find((item) => item.id === target.investmentId) ?? null,
    [investments],
  );

  const closeModal = useCallback(() => setModal({ kind: 'none' }), []);
  const reloadAndClose = useCallback(() => {
    setModal({ kind: 'none' });
    fetchDashboard();
  }, [fetchDashboard]);

  const handleDateRangeChange = useCallback((range: { from: string; to: string }) => {
    // from === to é válido: período de um único dia (mesma regra de Planejamento).
    if (!range.from || !range.to) return;
    setDateRange(range);
    setIsCalendarOpen(false);
  }, []);

  const handleEditSelected = useCallback(() => {
    if (!selectedInvestment) {
      showMessage('Selecione um investimento para editar', 'error');
      return;
    }
    setModal({ kind: 'edit', investment: selectedInvestment });
  }, [selectedInvestment, showMessage]);

  const handleExportExcel = useCallback(() => {
    const tableEl = tableRef.current?.getTableElement();
    if (!tableEl) return showMessage('Não há dados para exportar', 'error');
    const worksheet = XLSX.utils.table_to_sheet(tableEl);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Investimentos');
    XLSX.writeFile(workbook, `investimentos_${dateRange.from}_a_${dateRange.to}.xlsx`);
  }, [dateRange, showMessage]);

  const handleExportPDF = useCallback(() => {
    const tableEl = tableRef.current?.getTableElement();
    if (!tableEl) return showMessage('Não há dados para exportar', 'error');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    autoTable(doc, {
      html: tableEl,
      horizontalPageBreak: true,
      styles: { fontSize: 6, cellPadding: 2 },
      margin: { left: 20, right: 20 },
    });
    doc.save(`investimentos_${dateRange.from}_a_${dateRange.to}.pdf`);
  }, [dateRange, showMessage]);

  const toolbar = (
    <>
      <button type="button" onClick={() => setModal({ kind: 'create' })} className={iconButtonClass} title="Novo investimento">
        <Plus size={16} />
      </button>
      <button
        type="button"
        onClick={handleEditSelected}
        disabled={!selectedInvestment}
        className={iconButtonClass}
        title="Editar investimento selecionado"
      >
        <Pencil size={16} />
      </button>
      <button
        type="button"
        onClick={() => setModal({ kind: 'order' })}
        disabled={investments.length === 0}
        className={iconButtonClass}
        title="Editar ordem de visualização"
      >
        <ArrowUpDown size={16} />
      </button>
      <button
        type="button"
        onClick={() => setIsFilterVisible(true)}
        className={`relative ${iconButtonClass}`}
        title="Filtro"
      >
        <Filter size={16} color={activeFilterCount > 0 ? 'var(--color-brand-primary)' : undefined} />
        {activeFilterCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-brand text-content-inverse text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
            {activeFilterCount}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={handleExportExcel}
        disabled={isLoading || !data}
        className={iconButtonClass}
        title="Exportar Excel"
      >
        <FileSpreadsheet size={16} />
      </button>
      <button
        type="button"
        onClick={handleExportPDF}
        disabled={isLoading || !data}
        className={iconButtonClass}
        title="Exportar PDF"
      >
        <FileText size={16} />
      </button>
    </>
  );

  // Mesmo filtro de período de Planejamento e Controle: botão com o intervalo
  // e o CalendarPicker em popover.
  const periodControls = (
    <div className="relative flex items-center gap-1.5" data-investment-period>
      <button
        type="button"
        onClick={() => setIsCalendarOpen(!isCalendarOpen)}
        className="flex items-center gap-2 border border-ui-border rounded-lg px-3 py-1.5 text-xs text-content bg-surface hover:bg-surface-subtle focus:outline-none focus:border-brand transition-colors"
      >
        <Calendar size={14} className="text-content-secondary" />
        <span className="font-medium whitespace-nowrap">
          {formatDateBR(dateRange.from)} — {formatDateBR(dateRange.to)}
        </span>
      </button>
      {isCalendarOpen && (
        <div className="absolute top-full left-0 mt-2 bg-surface border border-ui-border-soft rounded-lg shadow-lg z-[200] p-4">
          <CalendarPicker dateRange={dateRange} onChange={handleDateRangeChange} />
        </div>
      )}
      <button
        type="button"
        onClick={fetchDashboard}
        disabled={isLoading}
        className="p-1.5 rounded-lg text-content-muted hover:text-content hover:bg-surface-subtle disabled:opacity-50 transition-colors"
        title="Recarregar"
      >
        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
      </button>
    </div>
  );

  // A pill mostra o denominador de fato do Grau de Indep. Financeira: o valor
  // de referência quando o usuário configurou um, senão os gastos planejados do
  // mês. Exibir outro número aqui faria a conta do indicador parecer errada.
  const hasReference = (data?.independence_reference_amount ?? 0) > 0;
  const plannedPill = (
    <button
      type="button"
      onClick={() => setModal({ kind: 'independence' })}
      className="inline-flex items-center gap-1 rounded-md bg-surface-subtle px-2.5 py-1 text-[11px] text-content-secondary whitespace-nowrap hover:bg-surface-muted transition-colors"
      title="Editar valor de referência da independência financeira"
    >
      {hasReference ? 'Valor de referência:' : 'Gastos planejados do mês atual:'}
      <strong className="text-brand">{formatCurrencyBRL(data?.independence_base ?? 0)}</strong>
    </button>
  );

  return (
    <Section title="Meus Investimentos">
      <div className="relative flex flex-col gap-4">
        {/* Mobile: os controles não cabem sobre a grid — ficam acima dela. */}
        <div className="flex flex-col gap-2 md:hidden">
          <div>{plannedPill}</div>
          <div className="flex items-center gap-2 flex-wrap">{periodControls}</div>
          <div className="flex items-center gap-2 flex-wrap">{toolbar}</div>
        </div>

        {/* Desktop: sobreposto às colunas congeladas do cabeçalho da grid. */}
        <div
          className="hidden md:flex absolute top-0 left-0 z-[100] flex-col justify-between py-1"
          style={{ width: LEFT_PANEL_WIDTH, height: STATS_BLOCK_HEIGHT }}
        >
          <div>{plannedPill}</div>
          <div className="flex items-center gap-1.5">{periodControls}</div>
          <div className="flex items-center gap-1.5">{toolbar}</div>
        </div>

        {isLoading && (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
          </div>
        )}

        {!isLoading && !data && (
          <div className="flex justify-center items-center h-64 text-content-muted text-sm">
            Nenhum dado encontrado para o período selecionado.
          </div>
        )}

        {!isLoading && data && (
          <div className="overflow-auto max-h-[calc(100vh-150px)] md:max-h-[calc(100vh-90px)] rounded-xl">
            <div className="inline-block align-top min-w-full">
              <InvestmentsTable
                ref={tableRef}
                data={data}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onEditInvestment={(investment) => setModal({ kind: 'edit', investment })}
                onEditNotes={(investment) => setModal({ kind: 'notes', investment })}
                onEditBalance={(target) => setModal({ kind: 'balance', target })}
                onAddContribution={(target) => setModal({ kind: 'contribution', target })}
                onManageContributions={(target) => setModal({ kind: 'contributions', target })}
                onEditIndependenceReference={() => setModal({ kind: 'independence' })}
              />
            </div>
          </div>
        )}
      </div>

      {(modal.kind === 'create' || modal.kind === 'edit') && (
        <InvestmentFormModal
          investment={modal.kind === 'edit' ? modal.investment : null}
          existing={investments}
          onClose={closeModal}
          onSaved={reloadAndClose}
        />
      )}

      {modal.kind === 'notes' && (
        <NotesModal investment={modal.investment} onClose={closeModal} onSaved={reloadAndClose} />
      )}

      {modal.kind === 'balance' &&
        (() => {
          const investment = investmentOf(modal.target);
          if (!investment) return null;
          const cell = investment.months.find(
            (m) => m.year === modal.target.year && m.month === modal.target.month,
          );
          return (
            <MonthBalanceModal
              investment={investment}
              year={modal.target.year}
              month={modal.target.month}
              currentBalance={cell?.balance ?? null}
              onClose={closeModal}
              onSaved={reloadAndClose}
            />
          );
        })()}

      {modal.kind === 'contribution' &&
        (() => {
          const investment = investmentOf(modal.target);
          if (!investment) return null;
          const firstDay = `${modal.target.year}-${String(modal.target.month).padStart(2, '0')}-01`;
          return (
            <ContributionFormModal
              investment={investment}
              defaultDate={firstDay}
              onClose={closeModal}
              onSaved={reloadAndClose}
            />
          );
        })()}

      {modal.kind === 'contributions' &&
        (() => {
          const investment = investmentOf(modal.target);
          if (!investment) return null;
          return (
            <ContributionsModal
              investment={investment}
              year={modal.target.year}
              month={modal.target.month}
              onClose={closeModal}
              onChanged={fetchDashboard}
            />
          );
        })()}

      {modal.kind === 'order' && (
        <InvestmentOrderModal investments={investments} onClose={closeModal} onSaved={reloadAndClose} />
      )}

      {modal.kind === 'independence' && (
        <IndependenceReferenceModal
          currentValue={data?.independence_reference_amount ?? null}
          onClose={closeModal}
          onSaved={reloadAndClose}
        />
      )}

      {isFilterVisible && (
        <DynamicFilterModal
          visible={isFilterVisible}
          setVisible={setIsFilterVisible}
          onApply={(applied) => {
            setAppliedFilters(applied);
            setIsFilterVisible(false);
          }}
          onClear={() => {
            setAppliedFilters({});
            setIsFilterVisible(false);
          }}
          title="Meus Investimentos"
          filters={dynamicFilters}
          initialValues={appliedFilters}
          columns={2}
        />
      )}
    </Section>
  );
}
