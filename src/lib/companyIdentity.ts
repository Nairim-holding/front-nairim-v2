import type { CompanyBranding } from '@/types/branding';

/**
 * Identidade jurídica e endereço do tenant (colunas de `CompanyBranding`).
 *
 * Compartilhado entre o cadastro/edição/visualização de Empresas, a tela de
 * Identidade Visual e o cabeçalho dos relatórios — as quatro precisam da mesma
 * lista de campos, e mantê-la num lugar só evita que uma delas fique para trás
 * quando um campo novo entrar.
 */
export const COMPANY_IDENTITY_FIELD_KEYS = [
  'legal_name',
  'cnpj',
  'phone',
  'email',
  'zip_code',
  'street',
  'number',
  'complement',
  'district',
  'city',
  'state',
] as const;

export type CompanyIdentityKey = (typeof COMPANY_IDENTITY_FIELD_KEYS)[number];

export interface CompanyIdentityFieldDef {
  field: CompanyIdentityKey;
  label: string;
  placeholder?: string;
  /** Largura no grid de 12 colunas dos formulários de Empresas. */
  span: 'full' | 'half' | 'third';
  maxLength?: number;
}

export const COMPANY_IDENTITY_FIELDS: CompanyIdentityFieldDef[] = [
  { field: 'legal_name', label: 'Razão social', placeholder: 'Ex: Nairim Holding LTDA', span: 'full' },
  { field: 'cnpj', label: 'CNPJ', placeholder: 'Ex: 00.000.000/0001-00', span: 'half', maxLength: 18 },
  { field: 'phone', label: 'Telefone', placeholder: 'Ex: (14) 3471-0000', span: 'half', maxLength: 20 },
  { field: 'email', label: 'E-mail', placeholder: 'Ex: contato@empresa.com.br', span: 'full' },
  { field: 'zip_code', label: 'CEP', placeholder: 'Ex: 17400-000', span: 'third', maxLength: 10 },
  { field: 'street', label: 'Logradouro', placeholder: 'Ex: Avenida Brasil', span: 'full' },
  { field: 'number', label: 'Número', placeholder: 'Ex: 64', span: 'third' },
  { field: 'complement', label: 'Complemento', placeholder: 'Ex: Sala 2', span: 'third' },
  { field: 'district', label: 'Bairro', placeholder: 'Ex: Centro', span: 'third' },
  { field: 'city', label: 'Cidade', placeholder: 'Ex: Garça', span: 'half' },
  { field: 'state', label: 'UF', placeholder: 'Ex: SP', span: 'third', maxLength: 2 },
];

type AddressSource = Partial<Pick<CompanyBranding, 'street' | 'number' | 'complement' | 'district' | 'city' | 'state' | 'zip_code'>>;

/**
 * Endereço numa linha só, para o cabeçalho dos relatórios e a visualização.
 * Cada trecho só entra se tiver conteúdo — endereço parcialmente preenchido
 * não pode virar `", -  /"`.
 */
export function formatCompanyAddress(source: AddressSource | null | undefined): string | null {
  if (!source) return null;

  const text = (value: string | null | undefined): string => (value ?? '').trim();

  const streetPart = [text(source.street), text(source.number)].filter(Boolean).join(', ');
  const localPart = [text(source.district), text(source.complement)].filter(Boolean).join(' - ');
  const cityPart = [text(source.city), text(source.state)].filter(Boolean).join('/');

  const line = [streetPart, localPart, cityPart].filter(Boolean).join(' - ');
  const zip = text(source.zip_code);

  const full = [line, zip && `CEP ${zip}`].filter(Boolean).join(' - ');
  return full.length > 0 ? full : null;
}
