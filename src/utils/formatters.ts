/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Moeda ──────────────────────────────────────────────────────────────────

export const formatCurrency = (value: any): string => {
  if (value === null || value === undefined || value === '') return '';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (typeof num !== 'number' || isNaN(num)) return '';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
};

export const formatCurrencyFixed = (v?: number): string =>
  typeof v === 'number' ? `R$ ${v.toFixed(2).replace('.', ',')}` : '';

export const formatCurrencyRounded = (v?: number): string =>
  typeof v === 'number'
    ? `R$ ${Math.round(v).toLocaleString('pt-BR')}`
    : '';

// ─── Data ────────────────────────────────────────────────────────────────────

export const formatDate = (v: any): string => {
  if (!v) return 'N/A';
  const date = new Date(v);
  return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString('pt-BR');
};

// ─── Número / Área ───────────────────────────────────────────────────────────

export const formatValueOrDash = (v: any): any =>
  v !== undefined && v !== null ? v : '';

export const formatPercent = (v: any): string => `${v?.toFixed(2) ?? '0'}%`;

export const formatSqm = (v: any): string => {
  if (v === null || v === undefined || v === '') return '';
  return `${v}m²`;
};

// ─── Documentos / Pessoas ────────────────────────────────────────────────────

export const formatCPFCNPJ = (value: string): string => {
  if (!value) return '-';
  const clean = value.replace(/\D/g, '');
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return value;
};

export const formatRG = (value: string): string => {
  if (!value) return '-';
  const clean = value.replace(/\D/g, '');
  if (clean.length >= 8 && clean.length <= 9) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
  }
  return value;
};

export const formatPhone = (value: string): string => {
  if (!value) return '-';
  const clean = value.replace(/\D/g, '');
  if (clean.length === 11) {
    return clean.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  if (clean.length === 10) {
    return clean.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  return value;
};

export const formatCEP = (cep: string): string => {
  if (!cep) return '-';
  const clean = cep.replace(/\D/g, '');
  if (clean.length === 8) {
    return clean.replace(/(\d{5})(\d{3})/, '$1-$2');
  }
  return cep;
};

export const formatBoolean = (value: boolean): string =>
  value ? 'Sim' : 'Não';

export const formatGender = (gender: string): string => {
  const map: Record<string, string> = {
    MALE: 'Masculino',
    FEMALE: 'Feminino',
    OTHER: 'Outro',
  };
  return map[gender] ?? gender;
};

export const formatRole = (role: string): string => {
  const map: Record<string, string> = {
    ADMIN: 'Administrador',
    DEFAULT: 'Padrão',
  };
  return map[role] ?? role;
};

// ─── Status de imóvel ────────────────────────────────────────────────────────

export const STATUS_MAP: Record<string, string> = {
  AVAILABLE: 'Disponível',
  RENTED: 'Alugado',
  OCCUPIED: 'Ocupado',
  SOLD: 'Vendido',
  MAINTENANCE: 'Manutenção',
  UNAVAILABLE: 'Indisponível',
};

export const formatStatus = (v: string): string => STATUS_MAP[v] || v || '-';

// ─── Imóvel / Contrato ───────────────────────────────────────────────────────

export const formatPropertyList = (properties: any[]): string => {
  if (!Array.isArray(properties) || properties.length === 0) return '-';
  const display = properties.slice(0, 3).map((p) => p.title).join(', ');
  return properties.length > 3
    ? `${display} (+${properties.length - 3})`
    : display;
};

export const formatAgency = (v: any): string =>
  v?.tradeName || v?.legalName || '-';

export const formatLeaseInfo = (value: any): string =>
  value
    ? `Contrato: ${value.contractNumber || 'N/A'} | Inquilino: ${value.tenantName || 'N/A'}`
    : 'Sem contrato ativo';

export const formatLastLeaseInfo = (v: any): string =>
  v ? `${v.tenantName} (Fim: ${formatDate(v.endDate)})` : 'N/A';

export const formatMissingDocs = (docs: string[]): string =>
  docs
    .map(
      (d) =>
        ({ TITLE_DEED: 'Escritura', REGISTRATION: 'Matrícula', PROPERTY_RECORD: 'Registro' }[d] || d),
    )
    .join(', ');
