import { formatDateDisplay } from './dateShortcuts';
import { getMyBrandingAction } from '@/server/actions/company';
import { listAgenciesAction } from '@/server/actions/agency';

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
/** Normaliza para comparar nomes de empresa sem acento/pontuação/sufixo societário. */
function normalizeCompanyName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(ltda|me|epp|eireli|s\.?a\.?|holding)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export async function fetchReportPrintHeaderData(): Promise<ReportPrintHeaderData | null> {
  try {
    // Todas as imobiliárias da empresa ativa (a extensão do Prisma já filtra
    // por company_id): a empresa pode ter mais de uma cadastrada e pegar
    // "a primeira" trazia os dados de outra imobiliária no cabeçalho
    // (Tarefa 5.1 — relatórios saíam com CNPJ/razão social da Adiplan).
    const [agencyRes, brandingRes] = await Promise.all([
      listAgenciesAction({ limit: 150 }),
      getMyBrandingAction(),
    ]);

    const agencyJson = agencyRes.ok ? (agencyRes.data as { data?: unknown }) : {};
    const agencies: AgencyResponse[] = Array.isArray(agencyJson?.data)
      ? (agencyJson.data as AgencyResponse[])
      : [];
    const branding = brandingRes.ok ? brandingRes.data : null;

    const brandingInfo = branding as {
      trade_name?: string;
      company_name?: string;
      logo_url?: string | null;
    } | null;

    // Nome exibido: sempre o da identidade visual da empresa ativa.
    const brandingName = brandingInfo?.trade_name || brandingInfo?.company_name || null;

    // Razão social/CNPJ/endereço vêm da imobiliária que corresponde a essa
    // identidade; sem correspondência, cai na primeira cadastrada.
    const target = brandingName ? normalizeCompanyName(brandingName) : '';
    const agency =
      (target
        ? agencies.find((a) => {
            const trade = normalizeCompanyName(a.trade_name ?? '');
            const legal = normalizeCompanyName(a.legal_name ?? '');
            return trade === target || legal === target || trade.includes(target) || target.includes(trade);
          })
        : undefined) ?? agencies[0];

    const address = agency?.addresses?.[0]?.address;
    const addressLine = address
      ? `${address.street}, ${address.number} ${address.district} - ${address.city}/${address.state}`
      : null;

    const contact = agency?.contacts?.[0];

    return {
      companyName: brandingName || agency?.trade_name || 'Empresa',
      legalName: agency?.legal_name ?? null,
      cnpj: agency?.cnpj ?? null,
      phone: contact?.phone ?? null,
      email: contact?.email ?? null,
      address: addressLine,
      logoUrl: brandingInfo?.logo_url ?? null,
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
