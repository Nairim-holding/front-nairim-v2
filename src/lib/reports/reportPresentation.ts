/** Keep composed accents and currency spacing compatible with PDF's standard fonts. */
export function reportText(value: string): string {
  return value.normalize('NFC').replace(/[\u00a0\u202f]/g, ' ')
    .replace(/→/g, '>').replace(/[−–—]/g, '-');
}

export function reportValueColor(classes: string): [number, number, number] | undefined {
  if (/text-(red|orange)-/.test(classes)) return [220, 38, 38];
  if (/text-(emerald|green)-/.test(classes)) return [5, 150, 105];
}

export function escapeReportHTML(value: string | null | undefined): string {
  return (value ?? '').normalize('NFC').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export function styleReportPDFCell({ cell, doc }: CellHookData): void {
  cell.text = cell.text.map(reportText);
  const element = typeof HTMLElement !== 'undefined' && cell.raw instanceof HTMLElement ? cell.raw : undefined;
  const color = reportValueColor(`${element?.className ?? ''} ${element?.parentElement?.className ?? ''}`);
  if (color) cell.styles.textColor = color;
  if (element?.classList.contains('text-right')) cell.styles.halign = 'right';
  if (element?.classList.contains('text-right') && /R\$/.test(cell.text.join(' '))) {
    cell.styles.minCellWidth = Math.max(cell.styles.minCellWidth, doc.getTextWidth(cell.text.join(' ')) + 8);
    cell.styles.overflow = 'visible';
  }
}

export function numberReportPDFPages(doc: jsPDF): void {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page); doc.setTextColor(71, 85, 105); doc.setFontSize(8);
    doc.text(`Página ${page}/${pages}`, doc.internal.pageSize.getWidth() - 20, doc.internal.pageSize.getHeight() - 14, { align: 'right' });
  }
}
import type { jsPDF } from 'jspdf';
import type { CellHookData } from 'jspdf-autotable';
