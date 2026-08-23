import { formatDateDisplay } from './dateShortcuts';
import { getMyBrandingAction } from '@/server/actions/company';
import { formatCompanyAddress } from '@/lib/companyIdentity';
import type { CompanyBranding } from '@/types/branding';

export interface ReportPrintHeaderData {
  companyName: string;
  legalName: string | null;
  cnpj: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  logoUrl: string | null;
}

/**
 * Dados de identificacao da empresa para o cabecalho de impressao.
 *
 * Tudo vem do TENANT ativo (CompanyBranding): nome/logo dos campos de
 * identidade visual, e razao social/CNPJ/telefone/endereco das colunas
 * proprias adicionadas em `20260823000000_add_company_branding_identity`.
 *
 * Antes o CNPJ/endereco vinham da tabela `Agency`, escolhendo a imobiliaria
 * cujo nome batia com o do tenant — quando nao batia, caia na primeira
 * cadastrada e o relatorio saia com o nome de uma empresa e o endereco de
 * outra ("Nairim Holding" + endereco da Adiplan). Imobiliaria e pessoa
 * juridica distinta do tenant, entao deixou de ser fonte deste cabecalho.
 *
 * Preenchidos em Empresas > Editar > Dados da Empresa (ou em Identidade
 * Visual, para a propria empresa do usuario).
 */
export async function fetchReportPrintHeaderData(): Promise<ReportPrintHeaderData | null> {
  try {
    const brandingRes = await getMyBrandingAction();
    const branding = brandingRes.ok ? (brandingRes.data as CompanyBranding | null) : null;

    // Nome exibido: sempre o da identidade visual do tenant ativo.
    const brandingName = branding?.trade_name || branding?.company_name || null;

    const text = (value: string | null | undefined): string | null => {
      const trimmed = (value ?? '').trim();
      return trimmed.length > 0 ? trimmed : null;
    };

    return {
      companyName: brandingName || 'Empresa',
      legalName: text(branding?.legal_name),
      cnpj: text(branding?.cnpj),
      phone: text(branding?.phone),
      email: text(branding?.email),
      address: formatCompanyAddress(branding),
      logoUrl: branding?.logo_url ?? null,
    };
  } catch (error) {
    console.error('[reportPrintHeader] Erro ao carregar dados da empresa:', error);
    return null;
  }
}

export interface ReportPrintContext {
  reportTitle: string;
  dateRange: { from: string; to: string };
  filterLabels: string[];
  userName: string;
}

/** HTML do cabeçalho, usado tanto na impressão (janela nova) quanto embutido antes da tabela exportada. */
export function buildReportPrintHeaderHTML(company: ReportPrintHeaderData | null, context: ReportPrintContext): string {
  const now = new Date();
  const printedAt = now.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const companyBlock = company
    ? `
      <div style="display:flex; align-items:flex-start; gap:12px;">
        ${company.logoUrl ? `<img src="${company.logoUrl}" alt="Logo" style="height:48px; width:auto; object-fit:contain;" />` : ''}
        <div>
          <div style="font-weight:700; font-size:14px;">${company.companyName}</div>
          ${company.legalName ? `<div style="font-size:11px; color:#475569;">${company.legalName}</div>` : ''}
          ${company.cnpj ? `<div style="font-size:11px; color:#475569;">CNPJ: ${company.cnpj}</div>` : ''}
          ${company.phone || company.email ? `<div style="font-size:11px; color:#475569;">Fone: ${company.phone ?? company.email}</div>` : ''}
          ${company.address ? `<div style="font-size:11px; color:#475569;">${company.address}</div>` : ''}
        </div>
      </div>
    `
    : '';

  return `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid #cbd5e1; padding-bottom:10px; margin-bottom:12px;">
      ${companyBlock}
      <div style="text-align:right; font-size:11px; color:#475569;">
        <div>Emitido por</div>
        <div style="font-weight:600; color:#111;">${context.userName}</div>
        <div>Impresso em</div>
        <div style="font-weight:600; color:#111;">${printedAt}</div>
      </div>
    </div>
    <div style="text-align:center; margin-bottom:10px;">
      <div style="font-weight:700; font-size:15px;">${context.reportTitle}</div>
      <div style="font-size:11px; color:#475569; margin-top:2px;">
        Período: ${formatDateDisplay(context.dateRange.from)} a ${formatDateDisplay(context.dateRange.to)}
        ${context.filterLabels.length > 0 ? ` &middot; Filtros: ${context.filterLabels.join(', ')}` : ''}
      </div>
    </div>
  `;
}
