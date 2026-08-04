import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/** Exporta a tabela renderizada (DOM) para Excel — mesmo padrão do Planejamento. */
export function exportTableToExcel(tableEl: HTMLTableElement | null, filename: string): boolean {
  if (!tableEl) return false;
  const worksheet = XLSX.utils.table_to_sheet(tableEl);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatório');
  XLSX.writeFile(workbook, `${filename}.xlsx`);
  return true;
}

/** Exporta a tabela renderizada (DOM) para PDF — mesmo padrão do Planejamento (modo html do autoTable). */
export function exportTableToPDF(tableEl: HTMLTableElement | null, filename: string, title?: string): boolean {
  if (!tableEl) return false;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  if (title) {
    doc.setFontSize(12);
    doc.text(title, 20, 24);
  }
  autoTable(doc, {
    html: tableEl,
    startY: title ? 34 : undefined,
    horizontalPageBreak: true,
    styles: { fontSize: 7, cellPadding: 3 },
    margin: { left: 20, right: 20 },
  });
  doc.save(`${filename}.pdf`);
  return true;
}

/** Abre uma janela só com o conteúdo do relatório e dispara a impressão do navegador. */
export function printReportElement(el: HTMLElement | null, title: string): boolean {
  if (!el) return false;
  const printWindow = window.open('', '_blank', 'width=1024,height=768');
  if (!printWindow) return false;

  printWindow.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 18px; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
  th { background: #f1f5f9; }
  .report-summary { margin-top: 16px; font-size: 13px; }
  .report-summary div { display: flex; justify-content: space-between; padding: 2px 0; }
  .negative { color: #dc2626; }
  .positive { color: #16a34a; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<h1>${title}</h1>
${el.outerHTML}
</body>
</html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.onload = () => {
    printWindow.print();
  };
  // Fallback caso onload não dispare (alguns navegadores com about:blank já carregado).
  setTimeout(() => printWindow.print(), 300);
  return true;
}
