'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, FileSpreadsheet, FileText, RefreshCw, Settings } from 'lucide-react';
import Section from '@/components/layout/PageSection';
import CalendarPicker from '@/components/ui/CalendarPicker';
import PropertyMultiSelect, { type PropertyOption } from '@/components/filters/PropertyMultiSelect';
import { useAuth } from '@/contexts/AuthContext';
import { useMessageContext } from '@/contexts/MessageContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import { getRoiReportAction } from '@/server/actions/property-roi';
import { exportTableToExcel, exportTableToPDF } from '@/lib/reports/exportHelpers';
import { ROI_LINE_DEFINITIONS, type RoiReport } from '@/core/entities/property-roi';
import type { RoiMetricKey } from '@/core/entities/property-roi-origin';
import RoiTable from './_components/RoiTable';
import RoiInspectionModal from './_components/RoiInspectionModal';
import RoiSaleScenario from './_components/RoiSaleScenario';
import RoiSettingsModal from './_components/RoiSettingsModal';
import { formatIsoDate } from './_lib/format';

const isoOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Últimos 12 meses até hoje — o padrão do período de referência das despesas. */
function lastTwelveMonths(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getFullYear() - 1, to.getMonth(), to.getDate() + 1);
  return { from: isoOf(from), to: isoOf(to) };
}

const yearRange = (year: number) => ({ from: `${year}-01-01`, to: `${year}-12-31` });

const YEAR_OPTIONS = (() => {
  const current = new Date().getFullYear();
  return Array.from({ length: 6 }, (_, index) => current - index);
})();

type Tab = 'roi' | 'sale';

export default function RoiContent() {
  const { showMessage } = useMessageContext();
  const { user } = useAuth();
  const { can } = usePermissions();
  const popoverRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const reportRequest = useRef(0);

  const [periodChoice, setPeriodChoice] = useState<string>('last12');
  const [dateRange, setDateRange] = useState(lastTwelveMonths);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [availableProperties, setAvailableProperties] = useState<PropertyOption[]>([]);
  const [report, setReport] = useState<RoiReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [inspection, setInspection] = useState<{ propertyIds: string[]; metric: RoiMetricKey | null } | null>(null);
  const [tab, setTab] = useState<Tab>('roi');

  useEffect(() => {
    if (!isCalendarOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) setIsCalendarOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCalendarOpen]);

  const fetchReport = useCallback(async () => {
    const request = ++reportRequest.current;
    setInspection(null);
    setIsLoading(true);
    try {
      const result = await getRoiReportAction({
        from: dateRange.from,
        to: dateRange.to,
        ...(selectedProperties.length > 0 ? { propertyIds: selectedProperties } : {}),
      });
      if (request !== reportRequest.current) return;
      if (!result.ok) throw new Error(result.error ?? 'Erro ao calcular o ROI.');
      setReport(result.data);
      setAvailableProperties(result.data.availableProperties);
    } catch (error) {
      if (request !== reportRequest.current) return;
      setReport(null);
      showMessage(error instanceof Error ? error.message : 'Erro ao calcular o ROI.', 'error', 4000);
    } finally {
      if (request === reportRequest.current) setIsLoading(false);
    }
  }, [dateRange, selectedProperties, showMessage]);

  useEffect(() => { void fetchReport(); }, [fetchReport]);

  const rows = useMemo(() => report?.rows ?? [], [report]);
  const detailRow = inspection?.propertyIds.length === 1 ? rows.find(row => row.propertyId === inspection.propertyIds[0]) ?? null : null;
  const closeInspection = useCallback(() => setInspection(null), []);
  const periodLabel = `${formatIsoDate(dateRange.from)} a ${formatIsoDate(dateRange.to)}`;
  const missingLabels = (report?.missingLines ?? []).map((key) => ROI_LINE_DEFINITIONS.find((definition) => definition.key === key)?.label ?? key);

  const exportReport = async (kind: 'excel' | 'pdf') => {
    try {
      const filename = `roi-imoveis-${dateRange.from}-a-${dateRange.to}`;
      if (kind === 'excel') await exportTableToExcel(tableRef.current, filename, 'financial-audit');
      else await exportTableToPDF(tableRef.current, filename, {
        auditResource: 'financial-audit',
        reportTitle: 'ROI por Imóvel',
        dateRange,
        periodLabel: `Despesas de ${periodLabel}`,
        filterLabels: selectedProperties.length ? [`${selectedProperties.length} imóvel(is) selecionado(s)`] : ['Todos os imóveis'],
        userName: user?.name ?? '—',
      });
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Erro ao exportar.', 'error', 4000);
    }
  };

  const tabClass = (value: Tab) => `px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === value ? 'bg-surface shadow-sm text-brand' : 'text-content-secondary hover:text-content'}`;

  return (
    <Section title="ROI por Imóvel">
      <div className="flex flex-col gap-4 relative">
        <div className="flex gap-3 items-center flex-wrap">
          {/* Período de referência das despesas anuais (IPTU, seguro, comissão, manutenção). */}
          <select
            value={periodChoice}
            onChange={(event) => {
              const value = event.target.value;
              setPeriodChoice(value);
              if (value === 'last12') setDateRange(lastTwelveMonths());
              else if (value !== 'custom') setDateRange(yearRange(Number(value)));
            }}
            className="border border-ui-border rounded-lg px-3 py-2 text-sm text-content bg-surface hover:bg-surface-subtle focus:outline-none focus:border-brand transition-colors"
            title="Período de referência das despesas anuais"
          >
            <option value="last12">Últimos 12 meses</option>
            {YEAR_OPTIONS.map((year) => <option key={year} value={year}>{year}</option>)}
            <option value="custom">Personalizado</option>
          </select>

          <div className="relative" ref={popoverRef}>
            <button
              type="button"
              onClick={() => setIsCalendarOpen((open) => !open)}
              className="flex items-center gap-2 border border-ui-border rounded-lg px-3 py-2 text-sm text-content bg-surface hover:bg-surface-subtle focus:outline-none focus:border-brand transition-colors"
            >
              <Calendar size={16} className="text-content-secondary" />
              <span className="font-medium whitespace-nowrap">{formatIsoDate(dateRange.from)} — {formatIsoDate(dateRange.to)}</span>
            </button>
            {isCalendarOpen && (
              <div className="absolute top-full left-0 mt-2 bg-surface border border-ui-border-soft rounded-lg shadow-lg z-[200] p-4">
                <CalendarPicker
                  dateRange={dateRange}
                  onChange={(range) => {
                    setDateRange(range);
                    setPeriodChoice('custom');
                    setIsCalendarOpen(false);
                  }}
                />
              </div>
            )}
          </div>

          <PropertyMultiSelect options={availableProperties} selected={selectedProperties} onChange={setSelectedProperties} />

          <button
            type="button"
            onClick={() => void fetchReport()}
            disabled={isLoading}
            className="p-2 rounded-lg border border-ui-border text-content-muted hover:text-content hover:bg-surface-subtle disabled:opacity-50 transition-colors"
            title="Recalcular"
            aria-label="Recalcular"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>

          <div className="flex items-center gap-2 ml-auto">
            {can('financial-audit', 'export') && tab === 'roi' && (
              <>
                <button type="button" onClick={() => void exportReport('excel')} disabled={isLoading || rows.length === 0} title="Exportar para Excel" aria-label="Exportar para Excel" className="p-2 rounded-lg border border-ui-border text-content-muted hover:text-content hover:bg-surface-subtle disabled:opacity-50 transition-colors">
                  <FileSpreadsheet size={16} />
                </button>
                <button type="button" onClick={() => void exportReport('pdf')} disabled={isLoading || rows.length === 0} title="Exportar para PDF" aria-label="Exportar para PDF" className="p-2 rounded-lg border border-ui-border text-content-muted hover:text-content hover:bg-surface-subtle disabled:opacity-50 transition-colors">
                  <FileText size={16} />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2 p-2 rounded-lg border border-ui-border text-content-muted hover:text-content hover:bg-surface-subtle transition-colors"
              title="Configurações do ROI"
            >
              <Settings size={16} />
              <span className="text-sm font-medium hidden sm:inline">Configurações</span>
            </button>
          </div>
        </div>

        {report && (report.usingSuggestedLines || missingLabels.length > 0) && (
          <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            {missingLabels.length > 0 && <p>Sem categoria definida (valor zerado no cálculo): {missingLabels.join(', ')}.</p>}
            {report.usingSuggestedLines && <p>As categorias foram identificadas automaticamente pelos nomes. Confira e salve em Configurações.</p>}
          </div>
        )}

        <div className="flex">
          <div className="flex bg-surface-subtle p-1 rounded-lg border border-ui-border-soft">
            <button type="button" onClick={() => setTab('roi')} className={tabClass('roi')}>Fluxo de Caixa e ROI</button>
            <button type="button" onClick={() => setTab('sale')} className={tabClass('sale')}>Cenário de Valorização</button>
          </div>
        </div>

        {tab === 'roi' ? (
          <>
            <p className="text-xs text-content-muted">
              Clique em um imóvel para abrir o detalhamento ou em um valor para consultar sua origem. As despesas anuais consideram {periodLabel}; investimento inicial e aluguéis consideram todo o histórico.
            </p>
            <RoiTable ref={tableRef} rows={rows} isLoading={isLoading} selectedId={detailRow?.propertyId ?? null}
              onSelect={propertyId => setInspection({ propertyIds: [propertyId], metric: null })}
              onInspect={(propertyIds, metric) => setInspection({ propertyIds, metric })} />
          </>
        ) : (
          <RoiSaleScenario rows={rows} />
        )}
      </div>

      {inspection && report && !isLoading && <RoiInspectionModal
        key={`${inspection.propertyIds.join(',')}:${inspection.metric ?? 'detail'}`}
        row={detailRow} propertyIds={inspection.propertyIds} metric={inspection.metric} period={report.period} onClose={closeInspection}
      />}

      {isSettingsOpen && (
        <RoiSettingsModal
          canEdit={can('financial-audit', 'edit')}
          onClose={() => setIsSettingsOpen(false)}
          onSaved={() => { setIsSettingsOpen(false); void fetchReport(); }}
        />
      )}
    </Section>
  );
}
