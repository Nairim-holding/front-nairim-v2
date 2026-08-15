import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchReportPrintHeaderData, buildReportPrintHeaderHTML, type ReportPrintContext } from './reportPrintHeader';

/**
 * Busca a logomarca da empresa e converte para data URL (Tarefa 4.3-D do guia
 * de correções) — `jsPDF.addImage` aceita data URL diretamente; uma URL
 * remota (`company.logoUrl`, servida por CDN externo) não é suficiente porque
 * o jsPDF não faz o fetch por conta própria. Falha em buscar/decodificar não
 * derruba a exportação — o PDF sai sem logo em vez de travar no export.
 */
async function fetchLogoAsDataUrl(logoUrl: string | null): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' } | null> {
  if (!logoUrl) return null;
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    const format = blob.type.includes('png') ? 'PNG' : 'JPEG';
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return { dataUrl, format };
  } catch (error) {
    console.error('[exportHelpers] Erro ao carregar logomarca para o PDF:', error);
    return null;
  }
}

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
  const logo = await fetchLogoAsDataUrl(company?.logoUrl ?? null);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  let cursorY = 24;
  // Texto do cabeçalho recua para a direita quando há logo, para não sobrepor a imagem.
  const textX = logo ? 66 : 20;

  if (logo) {
    try {
      doc.addImage(logo.dataUrl, logo.format, 20, 16, 36, 36);
    } catch (error) {
      console.error('[exportHelpers] Erro ao desenhar logomarca no PDF:', error);
    }
  }

  if (company?.companyName) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(company.companyName, textX, cursorY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    cursorY += 12;
    const details = [company.cnpj ? `CNPJ: ${company.cnpj}` : null, company.phone ?? company.email, company.address]
      .filter(Boolean)
      .join('  ·  ');
    if (details) {
      doc.text(details, textX, cursorY);
      cursorY += 14;
    }
  }

  cursorY = Math.max(cursorY, logo ? 62 : cursorY);

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

  const company = await fetchReportPrintHeaderData();
  const headerHTML = buildReportPrintHeaderHTML(company, context);
  // Título "Resumo" fixo acima do bloco (Tarefas 4.3-C/4.4-B): a tela não tem
  // esse cabeçalho porque o contexto já deixa claro que é o resumo (é o único
  // bloco fora da tabela); isoladamente numa página impressa, sem essa pista,
  // o bloco de números soltos no fim do documento perde contexto.
  const summaryHTML = summaryEl ? `<h3 class="report-summary-title">Resumo</h3>${summaryEl.outerHTML}` : '';

  const html = `<!doctype html>
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
  @media print { body { padding: 0; } }

  /*
   * Destaque das linhas de subtotal de grupo (Tarefa 4.3-E) — a tela já marca
   * essa linha com as classes font-semibold e bg-surface-subtle
   * (GroupedReportView), mas a classe utilitária do Tailwind não existe
   * nesta janela isolada, então a linha saía visualmente idêntica às de
   * lançamento. Vale para qualquer forma de agrupamento (Data, Categoria
   * etc.), pois o componente usa a mesma classe independente do critério.
   */
  .bg-surface-subtle { background-color: #f1f5f9 !important; }
  .font-semibold { font-weight: 600 !important; }
  .font-bold { font-weight: 700 !important; }

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

  /*
   * Bloco de Resumo final (Tarefas 4.3-C/4.4-B): antes o CSS de impressão
   * mirava numa classe .report-summary que o componente real nunca usa (o
   * markup usa classes Tailwind soltas — bg-surface, flex, justify-between
   * etc.), então nenhuma regra se aplicava e o navegador caía no display
   * default de cada tag (blocos empilhados sem espaçamento, rótulo e valor
   * colados). Os seletores abaixo miram as classes reais que o componente
   * gera (ExtratoView/IncomeExpenseView compartilham o mesmo padrão).
   */
  .report-summary-title {
    margin: 20px 0 0; padding: 8px 12px; background: #e2e8f0; color: #1e293b;
    font-size: 13px; font-weight: 700; text-align: center; border-radius: 6px 6px 0 0;
  }
  .max-w-md.ml-auto {
    max-width: 420px; margin-left: auto; border: 1px solid #cbd5e1; border-top: none;
    border-radius: 0 0 6px 6px; padding: 14px 16px; font-size: 13px;
  }
  .max-w-md.ml-auto > div {
    display: flex; justify-content: space-between; align-items: baseline;
    padding: 6px 0; border-bottom: 1px solid #e2e8f0;
  }
  .max-w-md.ml-auto > div:last-child { border-bottom: none; padding-top: 8px; }
  .max-w-md.ml-auto > div > span:first-child { color: #475569; }
  .max-w-md.ml-auto > div > span:last-child { font-weight: 600; }
  .text-emerald-600, .text-emerald-400 { color: #059669 !important; }
  .text-red-600, .text-red-400 { color: #dc2626 !important; }
</style>
</head>
<body>
<div class="cabecalho-impressao">${headerHTML}</div>
${el.outerHTML}
${summaryHTML}
</body>
</html>`;

  // Tarefa 4.3-B: nomes/descrições com acento saíam como "Ã¡", "Ã§" etc.
  // (mojibake clássico de UTF-8 lido como Latin-1) — a causa não era a fonte
  // do PDF (este relatório usa a janela de impressão do navegador, não o
  // jsPDF), e sim `document.write` numa janela `about:blank`: nesses casos o
  // encoding do documento pode ficar resolvido antes da `<meta charset>`
  // inserida via write ser processada a tempo, dependendo do navegador. Um
  // Blob com `text/html;charset=utf-8` remove essa ambiguidade — o encoding
  // vem do próprio Content-Type da resposta, não de uma tag processada em
  // paralelo com o parse.
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  const printWindow = window.open(blobUrl, '_blank', 'width=1024,height=768');
  if (!printWindow) {
    URL.revokeObjectURL(blobUrl);
    return false;
  }

  // Um único disparo de print(): `onload` cobre o caso comum, mas em alguns
  // navegadores o documento já está 'complete' quando chegamos aqui e o
  // evento load nunca chega a disparar — daí o fallback por readyState. Os
  // dois branches são mutuamente exclusivos (nunca os dois chamam print()),
  // o que evita abrir múltiplos diálogos de impressão para o mesmo clique.
  const triggerPrint = () => {
    printWindow.focus();
    printWindow.print();
    URL.revokeObjectURL(blobUrl);
  };
  if (printWindow.document.readyState === 'complete') {
    triggerPrint();
  } else {
    printWindow.onload = triggerPrint;
  }
  return true;
}
