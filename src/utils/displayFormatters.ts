/* eslint-disable @typescript-eslint/no-explicit-any */

import { maskMoney, maskPhone, maskCPF, maskCNPJ, maskCEP } from './masks';

export const parseCurrencyFromPTBR = (value: string | number): number => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;

  const strValue = value.toString();
  const cleaned = strValue
    .replace(/[R$\s ]/g, '')
    .replace(/[^\d.,-]/g, '');

  if (!cleaned) return 0;

  const hasComma = cleaned.includes(',');
  const dotCount = (cleaned.match(/\./g) || []).length;

  let normalized: string;
  if (hasComma) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (dotCount === 1 && /\.\d{1,2}$/.test(cleaned)) {
    normalized = cleaned;
  } else {
    normalized = cleaned.replace(/\./g, '');
  }

  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : num;
};


export const formatCurrency = (value: any): string => {
  if (value === null || value === undefined || value === '') return '';
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^\d.-]/g, '')) : Number(value);
  return isNaN(num) ? '' : maskMoney(num);
};

export const formatDate = (v: any): string => {
  if (!v) return 'N/A';
  if (typeof v === 'string') {
    const match = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
  }
  const date = new Date(v);
  if (isNaN(date.getTime())) return 'N/A';
  return new Date(date.getTime() + date.getTimezoneOffset() * 60000).toLocaleDateString('pt-BR');
};

export const formatCPFCNPJ = (value: string): string => {
  if (!value) return '-';
  const clean = value.replace(/\D/g, '');
  if (clean.length === 11) {
    return maskCPF(clean);
  }
  if (clean.length === 14) {
    return maskCNPJ(clean);
  }
  return value;
};

export const formatPhone = (value: string): string => {
  if (!value) return '-';
  return maskPhone(value);
};

export const formatRG = (value: string): string => {
  if (!value) return '-';
  const clean = value.replace(/\D/g, '');
  if (clean.length >= 8 && clean.length <= 9) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
  }
  return value;
};

export const formatCEP = (cep: string): string => {
  if (!cep) return '-';
  return maskCEP(cep);
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

export const formatStatus = (v: string): string => {
  const STATUS_MAP: Record<string, string> = {
    AVAILABLE: 'Disponível',
    RENTED: 'Alugado',
    OCCUPIED: 'Ocupado',
    SOLD: 'Vendido',
    MAINTENANCE: 'Manutenção',
    UNAVAILABLE: 'Indisponível',
  };
  return STATUS_MAP[v] || v || '-';
};

export const formatCurrencyFixed = (v?: number): string =>
  typeof v === 'number' ? maskMoney(v) : '';

export const formatCurrencyRounded = (v?: number): string =>
  typeof v === 'number'
    ? `R$ ${Math.round(v).toLocaleString('pt-BR')}`
    : '';

export const formatValueOrDash = (v: any): any =>
  v !== undefined && v !== null ? v : '';

export const formatPercent = (v: any): string => `${v?.toFixed(2) ?? '0'}%`;

export const formatSqm = (v: any): string => {
  if (v === null || v === undefined || v === '') return '';
  return `${v}m²`;
};

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
