/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Moeda ──────────────────────────────────────────────────────────────────

// Converte string monetária para número, tolerando formato pt-BR ("1.023,31")
// e formato cru/US vindo da API ("1023.31"). Regras:
//   - se houver vírgula → pt-BR: ponto = milhar, vírgula = decimal
//   - se só houver ponto e parecer decimal (1 ponto + 1-2 dígitos finais) → decimal
//   - caso contrário, ponto é tratado como separador de milhar
export const parseCurrencyFromPTBR = (value: string | number): number => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;

  const strValue = value.toString();

  const cleaned = strValue
    .replace(/[R$\s ]/g, '')
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

// Formata valor monetário para exibição (com R$)
export const formatCurrency = (value: any): string => {
  if (value === null || value === undefined || value === '') return '';
  const num = parseCurrencyFromPTBR(value);
  if (typeof num !== 'number' || isNaN(num)) return '';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
};

// DEPRECATED: Use maskMoney() from @/utils/masks instead.
// This function treats the last 2 digits as decimals, which is incorrect for user input.
// Example: maskCurrencyInput("200") returns "2,00" instead of "200,00".
// For input handling, use: parseCurrencyFromPTBR(value) for parsing, maskMoney(parsed) for display.
export const maskCurrencyInput = (value: string): string => {
  if (!value) return '';

  // Remove tudo que não é dígito
  const digits = value.replace(/\D/g, '');

  if (!digits) return '';

  // Divide em parte inteira e decimal (últimos 2 dígitos são centavos)
  const integerPart = digits.slice(0, -2) || '0';
  const decimalPart = digits.slice(-2).padEnd(2, '0');

  // Formata parte inteira com separador de milhar
  const formattedInteger = parseInt(integerPart, 10).toLocaleString('pt-BR');

  return `${formattedInteger},${decimalPart}`;
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
