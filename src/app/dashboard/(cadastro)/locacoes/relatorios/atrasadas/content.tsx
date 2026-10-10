'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { FileSpreadsheet, FileText, Printer } from 'lucide-react';
import Section from '@/components/layout/PageSection';
import { ReportingCompaniesProvider, ReportingCompanyFilter, useReportingCompanies } from '@/components/reports/ReportingCompanies';
import { useAuth, useMessageContext } from '@/contexts';
import { usePermissions } from '@/contexts/PermissionsContext';
import { getOverdueLeaseReportAction } from '@/server/actions/lease-report';
import { exportTableToExcel, exportTableToPDF, printReportElement } from '@/lib/reports/exportHelpers';
import { formatCurrency, formatDate } from '@/utils';
type Report = Extract<Awaited<ReturnType<typeof getOverdueLeaseReportAction>>, { ok: true }>['data'];
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export default function Content() { return <ReportingCompaniesProvider><ReportContent /></ReportingCompaniesProvider>; }
function ReportContent() {
  const { companyIds, companies } = useReportingCompanies(); const { user } = useAuth(); const { can } = usePermissions(); const { showMessage } = useMessageContext();
  const [asOf, setAsOf] = useState(today); const [generated, setGenerated] = useState<{ key: string; data: Report } | null>(null); const [busy, setBusy] = useState(false);
  const key = JSON.stringify([asOf, companyIds]); const report = generated?.key === key ? generated.data : null;
  const tableRef = useRef<HTMLTableElement>(null);
  const context = { auditResource: 'lease-reports' as const, reportTitle: 'Relatório de Locações Atrasadas', periodLabel: `Pendências anteriores a ${formatDate(asOf)}`,
    dateRange: { from: asOf, to: asOf }, userName: user?.name ?? '—', filterLabels: companyIds.length ? [`Empresas: ${companies.filter(company => companyIds.includes(company.id)).map(company => company.name).join(', ')}`] : [] };
  const generate = async () => { setBusy(true); try { const result = await getOverdueLeaseReportAction({ asOf, companyIds }); if (!result.ok) throw new Error(result.error); setGenerated({ key, data: result.data }); }
    catch (error) { showMessage(error instanceof Error ? error.message : 'Erro ao gerar relatório.', 'error'); } finally { setBusy(false); } };
  const exportReport = async (kind: 'excel' | 'pdf' | 'print') => { try { const filename = `locacoes-atrasadas-${asOf}`;
    if (kind === 'excel') await exportTableToExcel(tableRef.current, filename, 'lease-reports'); else if (kind === 'pdf') await exportTableToPDF(tableRef.current, filename, context); else printReportElement(tableRef.current, context);
  } catch (error) { showMessage(error instanceof Error ? error.message : 'Erro ao exportar.', 'error'); } };
  return <Section title="Relatório de Locações Atrasadas" action={<ReportingCompanyFilter />}>
    <div className="space-y-4"><Link href="/dashboard/locacoes/relatorios" className="text-sm text-brand">Relatório de recebimentos</Link>
      <div className="flex flex-wrap items-end gap-3"><label className="text-sm text-content">Data limite<input type="date" aria-label="Data limite dos atrasos" value={asOf} onChange={event => setAsOf(event.target.value)} className="mt-1 block rounded-lg border border-ui-border bg-surface p-2" /></label>
        <button type="button" onClick={() => void generate()} disabled={busy || !asOf} className="rounded-lg bg-brand px-4 py-2 text-sm text-white disabled:opacity-50">{busy ? 'Gerando…' : 'Gerar relatório'}</button>
        {can('lease-reports','export') && <div className="flex gap-2">{([['excel',FileSpreadsheet,'Exportar Excel'],['pdf',FileText,'Exportar PDF'],['print',Printer,'Imprimir']] as const).map(([kind,Icon,label]) => <button key={kind} type="button" aria-label={label} title={label} disabled={!report || busy} onClick={() => void exportReport(kind)} className="rounded-lg border border-ui-border p-2 text-content-muted disabled:opacity-50"><Icon size={20}/></button>)}</div>}
      </div>
      <p className="text-sm text-content-muted">Repasses de aluguel pendentes e vencidos, incluindo contratos encerrados que ainda têm valores a receber.</p>
      {report && <><p className="font-semibold text-content">{report.rows.length} repasse(s) — Total: {formatCurrency(report.total)}</p>
        {!!report.unmatched.length && <p role="alert" className="text-sm text-orange-600">{report.unmatched.length} lançamento(s) de aluguel sem contrato identificado. Confira o vínculo no financeiro.</p>}
        <div className="overflow-auto"><table ref={tableRef} className="w-full min-w-[1000px] text-left text-sm text-content"><thead><tr>{['Imobiliária','Imóvel','Mês/Ano','Contrato','Locatário','Vencimento','Dias em atraso','Valor','Descrição'].map(label => <th key={label} className="border-b border-ui-border p-2">{label}</th>)}</tr></thead>
          <tbody>{report.rows.map(row => <tr key={row.id}>{[row.agency,row.property,row.reference,row.contract,row.tenant,formatDate(row.dueDate),row.daysOverdue,formatCurrency(row.amount),row.description].map((value,index) => <td key={index} className="border-b border-ui-border p-2">{value}</td>)}</tr>)}{!report.rows.length && <tr><td colSpan={9} className="p-6 text-center">Nenhum repasse vencido e pendente até a data selecionada.</td></tr>}</tbody>
          <tfoot><tr><td colSpan={7} className="p-2 font-semibold">Total</td><td className="p-2 font-semibold">{formatCurrency(report.total)}</td><td /></tr></tfoot></table></div></>}
    </div>
  </Section>;
}
