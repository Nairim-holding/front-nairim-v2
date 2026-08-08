import { authFetch } from '@/utils/authFetch';
import { formatDateDisplay } from './dateShortcuts';

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

export interface ReportPrintHeaderData {
  companyName: string;
  legalName: string | null;
  cnpj: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  logoUrl: string | null;
}

interface AgencyResponse {
  id: string;
  trade_name: string;
  legal_name: string;
  cnpj: string;
  addresses?: { address: { street: string; number: string; district: string; city: string; state: string } }[];
  contacts?: { phone: string | null; email: string | null }[];
}

/**
 * Dados de identificação da empresa para o cabeçalho de impressão (Tarefa 4.3
 * do guia de correções). CNPJ/telefone/endereço vêm da primeira Imobiliária
 * ativa da empresa (é lá que o schema tem esses campos estruturados —
 * CompanyBranding.company_info é um blob livre, sem esse detalhamento). O
 * logo vem do branding, que é o mesmo em toda a aplicação.
 */
export async function fetchReportPrintHeaderData(): Promise<ReportPrintHeaderData | null> {
  try {
    const [agencyRes, brandingRes] = await Promise.all([
      authFetch(`${API_URL}/agencies?limit=1`),
      authFetch(`${API_URL}/company/branding`),
    ]);

    const agencyJson = await agencyRes.json().catch(() => ({}));
    const brandingJson = await brandingRes.json().catch(() => ({}));

    const agency: AgencyResponse | undefined = Array.isArray(agencyJson?.data) ? agencyJson.data[0] : undefined;
    const branding = brandingJson?.data;

    const address = agency?.addresses?.[0]?.address;
    const addressLine = address
      ? `${address.street}, ${address.number} ${address.district} - ${address.city}/${address.state}`
      : null;

    const contact = agency?.contacts?.[0];

    return {
      companyName: branding?.trade_name || branding?.company_name || agency?.trade_name || 'Empresa',
      legalName: agency?.legal_name ?? null,
      cnpj: agency?.cnpj ?? null,
      phone: contact?.phone ?? null,
      email: contact?.email ?? null,
      address: addressLine,
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
