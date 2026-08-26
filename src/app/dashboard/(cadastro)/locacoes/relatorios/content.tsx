'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, FileText, Printer, RefreshCw } from 'lucide-react';
import Section from '@/components/layout/PageSection';
import { useAuth } from '@/contexts/AuthContext';
import { useMessageContext } from '@/contexts/MessageContext';
import { getLeaseReportAction } from '@/server/actions/lease-report';
import { exportTableToExcel, exportTableToPDF, printReportElement } from '@/lib/reports/exportHelpers';
import { buildRedemptionRows, type InvestmentRedemptionInput, type LeaseReportResult, type ReferenceMonth } from '@/core/entities/lease-report';
import MonthSelector from './_components/MonthSelector';
import LeaseReportTable from './_components/LeaseReportTable';
import TaxPanels from './_components/TaxPanels';
import { describeSelectedMonths, exportFilename, selectionDateRange } from './_lib/referencePeriod';

/**
 * Tela do Relatório de Locações (menu Locações > Relatórios).
 *
 * O usuário escolhe um ou mais MESES DE REFERÊNCIA — não um intervalo de
 * datas. O aluguel de dezembro entra na conta em janeiro, e é o relatório que
 * faz essa conversão; a tela fala a língua do usuário ("dezembro de 2025").
 *
 * Exportação/impressão reaproveitam `@/lib/reports/exportHelpers`, os mesmos
 * dos Relatórios Financeiros — daí o cabeçalho padrão (logo, CNPJ, endereço,
 * quem emitiu, quando) sair idêntico nos dois módulos.
 */

/** Mês anterior ao atual: é o último mês de referência já fechado. */
function defaultMonth(): ReferenceMonth {
  const today = new Date();
  const reference = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  return { year: reference.getFullYear(), month: reference.getMonth() + 1 };
}

export default function LeaseReportsPageContent() {
  const { user } = useAuth();
  const { showMessage } = useMessageContext();

  const [months, setMonths] = useState<ReferenceMonth[]>(() => [defaultMonth()]);
  const [redemptions, setRedemptions] = useState<InvestmentRedemptionInput[]>([]);
  const [data, setData] = useState<LeaseReportResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const tableRef = useRef<HTMLTableElement>(null);
  const panelsRef = useRef<HTMLDivElement>(null);

  const periodLabel = useMemo(() => describeSelectedMonths(months), [months]);

  const printContext = useMemo(
    () => ({
      reportTitle: 'Relatório de Locações',
      dateRange: selectionDateRange(months),
      periodLabel,
      summaryTitle: 'Apuração de Impostos',
      filterLabels: [],
      userName: user?.name ?? '—',
    }),
    [months, periodLabel, user],
  );

  const generate = useCallback(async () => {
    if (months.length === 0) {
      showMessage('Selecione ao menos um mês de referência.', 'error');
      return;
    }
    setIsLoading(true);
    try {
      const result = await getLeaseReportAction({ months });
      if (!result.ok) throw new Error(result.error);
      setData(result.data);
    } catch (error) {
      setData(null);
      showMessage(error instanceof Error ? error.message : 'Erro ao gerar o relatório.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [months, showMessage]);

  // O quadro de Resgate é calculado aqui: rendimento e IR retido são digitados
  // na tela, então recalcular no servidor a cada tecla só custaria round-trip.
  const dataWithRedemptions = useMemo(() => {
    if (!data) return null;
    return { ...data, redemptionRows: buildRedemptionRows(data.quarters, redemptions) };
  }, [data, redemptions]);

  const filename = useMemo(() => exportFilename(months), [months]);

  const handlePrint = useCallback(() => {
    printReportElement(tableRef.current, printContext, panelsRef.current);
  }, [printContext]);

  const handleExportExcel = useCallback(() => {
    if (!exportTableToExcel(tableRef.current, filename)) {
      showMessage('Gere o relatório antes de exportar.', 'error');
    }
  }, [filename, showMessage]);

  const handleExportPDF = useCallback(() => {
    exportTableToPDF(tableRef.current, filename, printContext);
  }, [filename, printContext]);

  const canExport = !!data && !isLoading;

  return (
    <Section title="Relatório de Locações">
      <div className="flex flex-col lg:flex-row gap-4 mt-2">
        {/* ── Seleção do período ─────────────────────────────────────────── */}
        <aside className="w-full lg:w-[260px] shrink-0 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-content mb-1">Mês de referência</h2>
            <p className="text-[11px] text-content-muted leading-snug mb-2">
              Selecione o mês da locação. Os valores considerados são os creditados no mês seguinte —
              dezembro/2025 cai na conta em janeiro/2026.
            </p>
          </div>

          <MonthSelector selected={months} onChange={setMonths} />

          <button
            type="button"
            onClick={generate}
            disabled={isLoading || months.length === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            {isLoading ? 'Gerando...' : 'Gerar relatório'}
          </button>

          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={handlePrint}
              disabled={!canExport}
              title="Imprimir"
              className="flex items-center justify-center py-2 rounded-lg border border-ui-border-soft text-content-secondary hover:bg-surface-subtle hover:text-content transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Printer size={16} />
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={!canExport}
              title="Exportar para Excel"
              className="flex items-center justify-center py-2 rounded-lg border border-ui-border-soft text-content-secondary hover:bg-surface-subtle hover:text-content transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet size={16} />
            </button>
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={!canExport}
              title="Exportar para PDF"
              className="flex items-center justify-center py-2 rounded-lg border border-ui-border-soft text-content-secondary hover:bg-surface-subtle hover:text-content transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileText size={16} />
            </button>
          </div>
        </aside>

        {/* ── Relatório ──────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="rounded-xl border border-ui-border-soft bg-surface">
            <div className="px-3 py-2 border-b border-ui-border-soft">
              <h2 className="text-sm font-semibold text-content">Locações</h2>
              <p className="text-[11px] text-content-muted">{periodLabel}</p>
            </div>

            {isLoading && (
              <div className="flex justify-center items-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
              </div>
            )}

            {!isLoading && !dataWithRedemptions && (
              <div className="px-3 py-12 text-center text-sm text-content-muted">
                Escolha o mês de referência e clique em <span className="font-semibold text-content">Gerar relatório</span>.
              </div>
            )}

            {!isLoading && dataWithRedemptions && <LeaseReportTable ref={tableRef} data={dataWithRedemptions} />}
          </div>

          {!isLoading && dataWithRedemptions && (
            <TaxPanels
              ref={panelsRef}
              data={dataWithRedemptions}
              redemptionRows={dataWithRedemptions.redemptionRows}
              redemptions={redemptions}
              onRedemptionsChange={setRedemptions}
            />
          )}
        </div>
      </div>
    </Section>
  );
}
