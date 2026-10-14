import 'server-only';
import { getDocumentProxy } from 'unpdf';
import { layoutFromTextItems, type PdfPageLayout } from '@/core/entities/municipal-property-document';

/**
 * Extrai o texto de um PDF com a posição de cada trecho, já organizado em
 * linhas por página. Só serve para PDF com texto selecionável — documento
 * escaneado (imagem) volta com as páginas vazias.
 *
 * Camada: infra.
 */

/** Carnês e fichas têm poucas páginas; o teto evita processar um PDF qualquer por engano. */
const MAX_PAGES = 30;

export async function extractPdfLayout(buffer: Uint8Array): Promise<PdfPageLayout[]> {
  const pdf = await getDocumentProxy(buffer);
  const pages: PdfPageLayout[] = [];
  for (let number = 1; number <= Math.min(pdf.numPages, MAX_PAGES); number += 1) {
    const page = await pdf.getPage(number);
    const content = await page.getTextContent();
    const items = content.items.flatMap((item) => (
      'str' in item && typeof item.str === 'string' ? [{ text: item.str, transform: item.transform as number[] }] : []
    ));
    pages.push(layoutFromTextItems(items));
  }
  return pages;
}
