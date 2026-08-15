'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import Section from '@/components/layout/PageSection';
import ReportsSidebar from './_components/ReportsSidebar';
import ReportsTopBar from './_components/ReportsTopBar';
import GroupedReportView from './_components/GroupedReportView';
import ExtratoView from './_components/ExtratoView';
import IncomeExpenseView from './_components/IncomeExpenseView';
import DemonstrativoView from './_components/DemonstrativoView';
import { useReportOptions } from './_lib/useReportOptions';
import { getDefaultReportDateRange } from './_lib/dateShortcuts';
import { describeActiveFilters } from './_lib/buildReportQuery';
import { exportTableToExcel, exportTableToPDF, printReportElement } from './_lib/exportHelpers';
import { useAuth } from '@/contexts/AuthContext';
import { EMPTY_FILTERS } from './_lib/types';
import type { ReportFiltersState, ReportGroupBy, ReportKind, ReportRegime, ReportViewHandle, SelectedReport } from './_lib/types';

const DESPESAS_LABELS: Record<ReportGroupBy, { title: string; groupColumnLabel: string }> = {
  description: { title: 'Despesas por Descrição', groupColumnLabel: 'Descrição' },
  day: { title: 'Despesas por Dia', groupColumnLabel: 'Dia' },
  category: { title: 'Despesas por Tipo', groupColumnLabel: 'Tipo' },
  subcategory: { title: 'Despesas por Categoria', groupColumnLabel: 'Categoria' },
  contact: { title: 'Pago a...', groupColumnLabel: 'Contato' },
  center: { title: 'Despesas por Centro de Despesa', groupColumnLabel: 'Centro' },
};

const RECEITAS_LABELS: Record<ReportGroupBy, { title: string; groupColumnLabel: string }> = {
  description: { title: 'Receitas por Descrição', groupColumnLabel: 'Descrição' },
  day: { title: 'Receitas por Dia', groupColumnLabel: 'Dia' },
  category: { title: 'Receitas por Tipo', groupColumnLabel: 'Tipo' },
  subcategory: { title: 'Receitas por Categoria', groupColumnLabel: 'Categoria' },
  contact: { title: 'Recebido de...', groupColumnLabel: 'Contato' },
  center: { title: 'Receitas por Centro de Receita', groupColumnLabel: 'Centro' },
};

const FLUXO_FILENAMES: Record<string, string> = {
  extrato: 'extrato',
  'income-expense': 'receitas_despesas',
  demonstrativo: 'demonstrativo',
};

export default function RelatoriosPageContent() {
  const { options, isLoading: isLoadingOptions } = useReportOptions();
  const { user } = useAuth();

  const [selected, setSelected] = useState<SelectedReport>({ section: 'despesas', item: 'description' });
  const [dateRange, setDateRange] = useState(() => getDefaultReportDateRange());
  const [regime, setRegime] = useState<ReportRegime>('caixa');
  const [reportKind, setReportKind] = useState<ReportKind>('sintetico');
  const [filters, setFilters] = useState<ReportFiltersState>(EMPTY_FILTERS);

  const activeViewRef = useRef<ReportViewHandle>(null);

  const filename = useMemo(() => {
    const base =
      selected.section === 'fluxo'
        ? FLUXO_FILENAMES[selected.item] ?? selected.item
        : `${selected.section}_${selected.item}`;
    return `${base}_${dateRange.from}_a_${dateRange.to}`;
  }, [selected, dateRange]);

  const reportTitle = useMemo(() => {
    if (selected.section === 'despesas') return DESPESAS_LABELS[selected.item as ReportGroupBy].title;
    if (selected.section === 'receitas') return RECEITAS_LABELS[selected.item as ReportGroupBy].title;
    if (selected.item === 'extrato') return 'Extrato';
    if (selected.item === 'income-expense') return 'Receitas / Despesas';
    return 'Demonstrativo';
  }, [selected]);

  const printContext = useMemo(
    () => ({
      reportTitle,
      dateRange,
      filterLabels: describeActiveFilters(filters, options),
      userName: user?.name ?? '—',
    }),
    [reportTitle, dateRange, filters, options, user]
  );

  const handlePrint = useCallback(() => {
    printReportElement(
      activeViewRef.current?.getTableElement() ?? null,
      printContext,
      activeViewRef.current?.getSummaryElement?.() ?? null
    );
  }, [printContext]);

  const handleExportExcel = useCallback(() => {
    exportTableToExcel(activeViewRef.current?.getTableElement() ?? null, filename);
  }, [filename]);

  const handleExportPDF = useCallback(() => {
    exportTableToPDF(activeViewRef.current?.getTableElement() ?? null, filename, printContext);
  }, [filename, printContext]);

  const hideTypeFilter = selected.section === 'despesas' || selected.section === 'receitas';

  return (
    <Section title="Relatórios" fill>
      <div className="flex flex-1 min-h-0 -mx-3 sm:-mx-4 border-t border-ui-border-soft">
        <ReportsSidebar selected={selected} onSelect={setSelected} />

        <div className="flex flex-col flex-1 min-w-0">
          <ReportsTopBar
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            reportKind={reportKind}
            onReportKindChange={setReportKind}
            regime={regime}
            onRegimeChange={setRegime}
            filters={filters}
            onFiltersChange={setFilters}
            options={options}
            hideTypeFilter={hideTypeFilter}
            onPrint={handlePrint}
            onExportExcel={handleExportExcel}
            onExportPDF={handleExportPDF}
            canExport={!isLoadingOptions}
          />

          <div className="flex-1 min-h-0 overflow-y-auto">
            {selected.section === 'despesas' && (
              <GroupedReportView
                key={`despesas-${selected.item}`}
                ref={activeViewRef}
                title={DESPESAS_LABELS[selected.item as ReportGroupBy].title}
                groupColumnLabel={DESPESAS_LABELS[selected.item as ReportGroupBy].groupColumnLabel}
                groupBy={selected.item as ReportGroupBy}
                typeOverride="EXPENSE"
                accentColor="#f97316"
                dateRange={dateRange}
                regime={regime}
                reportKind={reportKind}
                filters={filters}
              />
            )}

            {selected.section === 'receitas' && (
              <GroupedReportView
                key={`receitas-${selected.item}`}
                ref={activeViewRef}
                title={RECEITAS_LABELS[selected.item as ReportGroupBy].title}
                groupColumnLabel={RECEITAS_LABELS[selected.item as ReportGroupBy].groupColumnLabel}
                groupBy={selected.item as ReportGroupBy}
                typeOverride="INCOME"
                accentColor="#10b981"
                dateRange={dateRange}
                regime={regime}
                reportKind={reportKind}
                filters={filters}
              />
            )}

            {selected.section === 'fluxo' && selected.item === 'extrato' && (
              <ExtratoView key="extrato" ref={activeViewRef} dateRange={dateRange} regime={regime} filters={filters} />
            )}

            {selected.section === 'fluxo' && selected.item === 'income-expense' && (
              <IncomeExpenseView
                key="income-expense"
                ref={activeViewRef}
                dateRange={dateRange}
                regime={regime}
                reportKind={reportKind}
                filters={filters}
              />
            )}

            {selected.section === 'fluxo' && selected.item === 'demonstrativo' && (
              <DemonstrativoView key="demonstrativo" ref={activeViewRef} dateRange={dateRange} regime={regime} filters={filters} />
            )}
          </div>
        </div>
      </div>
    </Section>
  );
}
