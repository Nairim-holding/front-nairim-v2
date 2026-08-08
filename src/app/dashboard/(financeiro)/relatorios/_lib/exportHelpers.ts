import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchReportPrintHeaderData, buildReportPrintHeaderHTML, type ReportPrintContext } from './reportPrintHeader';

/** Exporta a tabela renderizada (DOM) para Excel — mesmo padrão do Planejamento. */
export function exportTableToExcel(tableEl: HTMLTableElement | null, filename: string): boolean {
  if (!tableEl) return false;
  const worksheet = XLSX.utils.table_to_sheet(tableEl);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatório');
  XLSX.writeFile(workbook, `${filename}.xlsx`);
  return true;
}

/**
 * Exporta a tabela renderizada (DOM) para PDF — mesmo padrão do Planejamento
 * (modo html do autoTable). Cabeçalho com dados da empresa (Tarefa 4.3 do
 * guia de correções) desenhado como texto antes da tabela, só na 1ª página.
 */
export async function exportTableToPDF(tableEl: HTMLTableElement | null, filename: string, context: ReportPrintContext): Promise<boolean> {
  if (!tableEl) return false;
  const company = await fetchReportPrintHeaderData();

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  let cursorY = 24;

  if (company?.companyName) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(company.companyName, 20, cursorY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    cursorY += 12;
    const details = [company.cnpj ? `CNPJ: ${company.cnpj}` : null, company.phone ?? company.email, company.address]
      .filter(Boolean)
      .join('  ·  ');
    if (details) {
      doc.text(details, 20, cursorY);
      cursorY += 14;
    }
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(context.reportTitle, 20, cursorY);
  doc.setFont('helvetica', 'normal');
  cursorY += 12;
  doc.setFontSize(8);
  const periodLine = `Período: ${context.dateRange.from.split('-').reverse().join('/')} a ${context.dateRange.to.split('-').reverse().join('/')}`
    + (context.filterLabels.length > 0 ? `  ·  Filtros: ${context.filterLabels.join(', ')}` : '');
  doc.text(periodLine, 20, cursorY);
  cursorY += 8;

  autoTable(doc, {
    html: tableEl,
    startY: cursorY + 10,
    horizontalPageBreak: true,
    styles: { fontSize: 7, cellPadding: 3 },
    margin: { left: 20, right: 20 },
  });
  doc.save(`${filename}.pdf`);
  return true;
}

/**
 * Abre uma janela só com o conteúdo do relatório e dispara a impressão do
 * navegador. Cabeçalho com dados da empresa (Tarefa 4.3): logo, CNPJ,
 * endereço, período, filtros aplicados, quem emitiu e quando — presente só na
 * 1ª página via `break-after: avoid` no CSS de impressão.
 */
export async function printReportElement(el: HTMLElement | null, context: ReportPrintContext, summaryEl?: HTMLElement | null): Promise<boolean> {
  if (!el) return false;
  const printWindow = window.open('', '_blank', 'width=1024,height=768');
  if (!printWindow) return false;

  const company = await fetchReportPrintHeaderData();
  const headerHTML = buildReportPrintHeaderHTML(company, context);
  const summaryHTML = summaryEl ? summaryEl.outerHTML : '';

  printWindow.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${context.reportTitle}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; padding: 24px; color: #111; }
  .cabecalho-impressao { break-after: avoid; page-break-after: avoid; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
  th { background: #f1f5f9; }
  .report-summary { margin-top: 16px; font-size: 13px; }
  .report-summary div { display: flex; justify-content: space-between; padding: 2px 0; }
  .negative { color: #dc2626; }
  .positive { color: #16a34a; }
  @media print { body { padding: 0; } }

  /*
   * Tarefa 4.5: a janela de impressão não carrega o Tailwind (é HTML isolado
   * escrito à parte), então as classes verde/laranja de Receitas/Despesas
   * (IncomeExpenseView) precisam de equivalente explícito aqui — mesmas cores
   * usadas na tela.
   */
  .bg-emerald-50 { background-color: #ecfdf5 !important; }
  .text-emerald-800 { color: #065f46 !important; }
  .text-emerald-900 { color: #064e3b !important; }
  .text-emerald-700\/80 { color: #047857cc !important; }
  .bg-emerald-50\/60 { background-color: #ecfdf599 !important; }
  .bg-orange-50 { background-color: #fff7ed !important; }
  .text-orange-800 { color: #9a3412 !important; }
  .text-orange-900 { color: #7c2d12 !important; }
  .text-orange-700\/80 { color: #c2410ccc !important; }
  .bg-orange-50\/60 { background-color: #fff7ed99 !important; }
</style>
</head>
<body>
<div class="cabecalho-impressao">${headerHTML}</div>
${el.outerHTML}
${summaryHTML}
</body>
</html>`);
  printWindow.document.close();
  printWindow.focus();

  // Um único disparo de print(): `onload` cobre o caso comum, mas em alguns
  // navegadores o documento já está 'complete' quando chegamos aqui (a janela
  // foi aberta e o write/close já rodaram de forma síncrona o bastante) e o
  // evento load nunca chega a disparar — daí o fallback por readyState. Os
  // dois branches são mutuamente exclusivos (nunca os dois chamam print()),
  // o que evita abrir múltiplos diálogos de impressão para o mesmo clique.
  if (printWindow.document.readyState === 'complete') {
    printWindow.print();
  } else {
    printWindow.onload = () => printWindow.print();
  }
  return true;
}
