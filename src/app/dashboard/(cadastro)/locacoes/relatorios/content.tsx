'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, FileText, Printer, RefreshCw, RotateCcw } from 'lucide-react';
import Section from '@/components/layout/PageSection';
import { useAuth } from '@/contexts/AuthContext';
import { useMessageContext } from '@/contexts/MessageContext';
import { getLeaseReportAction } from '@/server/actions/lease-report';
import { getColumnPreferencesAction, saveColumnPreferencesAction } from '@/server/actions/user-preferences';
import { exportTableToExcel, exportTableToPDF, printReportElement } from '@/lib/reports/exportHelpers';
import { buildRedemptionRows, type InvestmentRedemptionInput, type LeaseReportResult, type LeaseReportRow, type ReferenceMonth } from '@/core/entities/lease-report';
import MonthSelector from './_components/MonthSelector';
import LeaseReportTable from './_components/LeaseReportTable';
import TaxPanels from './_components/TaxPanels';
import { currentReferenceMonth, describeSelectedMonths, exportFilename, selectionDateRange } from './_lib/referencePeriod';
import { buildLeaseReportSummaryHTML, LEASE_REPORT_TABLE_STYLES } from './_lib/printLayout';

/** Chave de `resource` reaproveitando o mecanismo genérico de UserColumnPreference. */
const ROW_ORDER_RESOURCE = 'lease-reports-row-order';

/**
 * O schema de `saveColumnPreferencesAction` exige array não vazio — não dá
 * para persistir "sem ordem customizada" como `[]`. Este marcador único
 * representa esse estado; nunca colide com um `lease_id` de verdade (uuid).
 */
const NO_CUSTOM_ORDER = '__default__';

/**
 * Aplica a ordem salva às linhas do relatório: locações da ordem salva
 * primeiro (na sequência salva), e o restante (locações novas, fora da
 * ordem salva) depois, na ordem que já vinha do servidor (alfabética).
 */
function applyRowOrder(rows: LeaseReportRow[], order: string[]): LeaseReportRow[] {
  if (order.length === 0) return rows;
  const byId = new Map(rows.map((row) => [row.lease_id, row]));
  const ordered = order.map((id) => byId.get(id)).filter((row): row is LeaseReportRow => !!row);
  const orderedIds = new Set(ordered.map((row) => row.lease_id));
  const rest = rows.filter((row) => !orderedIds.has(row.lease_id));
  return [...ordered, ...rest];
}

/**
 * Tela do Relatório de Locações (menu Locações > Relatórios).
 *
 * O usuário escolhe os meses de apuração dos recebimentos pela data efetiva.
 *
 * Exportação/impressão reaproveitam `@/lib/reports/exportHelpers`, os mesmos
 * dos Relatórios Financeiros — daí o cabeçalho padrão (logo, CNPJ, endereço,
 * quem emitiu, quando) sair idêntico nos dois módulos.
 */

export default function LeaseReportsPageContent() {
  const { user } = useAuth();
  const { showMessage } = useMessageContext();

  const [months, setMonths] = useState<ReferenceMonth[]>(() => [currentReferenceMonth()]);
  const [redemptions, setRedemptions] = useState<InvestmentRedemptionInput[]>([]);
  const [data, setData] = useState<LeaseReportResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [rowOrder, setRowOrder] = useState<string[]>([]);

  const tableRef = useRef<HTMLTableElement>(null);
  const panelsRef = useRef<HTMLDivElement>(null);

  // Ordem salva pelo usuário (arrastar-e-soltar na tabela) — carregada uma vez;
  // reaproveita o mecanismo genérico de UserColumnPreference (columnOrder),
  // já que este app não tem mais backend próprio para uma tabela dedicada.
  useEffect(() => {
    getColumnPreferencesAction(ROW_ORDER_RESOURCE).then((result) => {
      if (!result.ok) return;
      const saved = result.data.columnOrder;
      setRowOrder(saved.length === 1 && saved[0] === NO_CUSTOM_ORDER ? [] : saved);
    });
  }, []);

  const dataOrdered = useMemo<LeaseReportResult | null>(() => {
    if (!data) return null;
    return { ...data, rows: applyRowOrder(data.rows, rowOrder) };
  }, [data, rowOrder]);

  const persistRowOrder = useCallback((columnOrder: string[]) => {
    saveColumnPreferencesAction({ resource: ROW_ORDER_RESOURCE, columnOrder, columnWidths: {} }).then((result) => {
      if (!result.ok) showMessage('Não foi possível salvar a ordem dos imóveis.', 'error');
    });
  }, [showMessage]);

  const handleReorder = useCallback((orderedLeaseIds: string[]) => {
    setRowOrder(orderedLeaseIds);
    persistRowOrder(orderedLeaseIds);
  }, [persistRowOrder]);

  const handleResetOrder = useCallback(() => {
    setRowOrder([]);
    persistRowOrder([NO_CUSTOM_ORDER]);
  }, [persistRowOrder]);

  const periodLabel = useMemo(() => describeSelectedMonths(months), [months]);

  const printContext = useMemo(
    () => ({
      reportTitle: 'Relatório de Locações',
      dateRange: selectionDateRange(months),
      periodLabel,
      summaryTitle: 'Apuração de Impostos',
      filterLabels: data?.warnings?.length || data?.unmatched?.length ? ['Há valores que precisam de conferência na tela'] : [],
      userName: user?.name ?? '—',
    }),
    [months, periodLabel, user, data],
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
  // Parte de `dataOrdered` (não de `data`) para que a tabela impressa/exportada
  // saia na ordem que o usuário arrastou na tela.
  const dataWithRedemptions = useMemo(() => {
    if (!dataOrdered) return null;
    return { ...dataOrdered, redemptionRows: buildRedemptionRows(dataOrdered.quarters, redemptions) };
  }, [dataOrdered, redemptions]);

  const filename = useMemo(() => exportFilename(months), [months]);

  const handlePrint = useCallback(() => {
    if (!dataWithRedemptions) return;
    // Resumo fiscal impresso reproduz o modelo em planilha do cliente
    // (ver `printLayout.ts`), não o grid de cards do `panelsRef` da tela.
    const rawSummaryHTML = buildLeaseReportSummaryHTML(dataWithRedemptions, dataWithRedemptions.redemptionRows);
    printReportElement(tableRef.current, printContext, panelsRef.current, {
      rawSummaryHTML,
      extraStyles: LEASE_REPORT_TABLE_STYLES,
    });
  }, [printContext, dataWithRedemptions]);

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
      <div className="flex min-w-0 flex-col gap-4 mt-2">
        {/* ── Seleção do período ─────────────────────────────────────────── */}
        <aside className="grid w-full min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
          <fieldset disabled={isLoading} className="min-w-0 space-y-2 disabled:opacity-60">
          <div>
            <h2 className="text-sm font-semibold text-content mb-1">Mês de referência</h2>
          </div>

          <MonthSelector selected={months} onChange={(selected) => { setMonths(selected); setData(null); }} />
          </fieldset>

          <div className="space-y-3">
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
          </div>
        </aside>

        {/* ── Relatório ──────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">
          <p className="text-xs text-content-muted">Valores recebidos no mês selecionado, conforme a data efetiva dos lançamentos concluídos. Multas compõem o faturamento e são somadas uma única vez ao líquido.</p>
          {!!dataWithRedemptions?.unmatched?.length && (
            <details className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <summary className="cursor-pointer font-medium">{dataWithRedemptions.unmatched.length} lançamento(s) precisam de vínculo com a locação para entrar nos totais</summary>
              <ul className="mt-2 space-y-1">
                {dataWithRedemptions.unmatched.map((item) => <li key={item.id}>{item.description} · {item.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</li>)}
              </ul>
            </details>
          )}
          <div className="rounded-xl border border-ui-border-soft bg-surface">
            <div className="px-3 py-2 border-b border-ui-border-soft flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-content">Locações</h2>
                <p className="text-[11px] text-content-muted">{periodLabel}</p>
              </div>
              {!isLoading && !!dataWithRedemptions?.rows.length && rowOrder.length > 0 && (
                <button
                  type="button"
                  onClick={handleResetOrder}
                  title="Restaurar ordem padrão (alfabética)"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-content-secondary hover:bg-surface-subtle hover:text-content transition-colors"
                >
                  <RotateCcw size={13} />
                  Restaurar ordem padrão
                </button>
              )}
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

            {!isLoading && dataWithRedemptions && (
              <>
                {dataWithRedemptions.rows.length > 1 && (
                  <p className="px-3 pt-2 text-[11px] text-content-muted">Arraste pela alça à esquerda para reordenar os imóveis.</p>
                )}
                <LeaseReportTable ref={tableRef} data={dataWithRedemptions} onReorder={handleReorder} />
              </>
            )}
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
