/**
 * Tradução de rótulos para a tela de Auditoria (Logs).
 * Porte de api-nairim-v2/src/lib/auditModels.ts.
 *
 * `table_name` grava o nome bruto do model Prisma — a tradução é só de
 * exibição/filtro, para que filtrar por tabela continue exato mesmo se o
 * rótulo mudar.
 *
 * Camada: shared (dado estático puro, sem I/O).
 */

export const MODEL_LABELS: Record<string, string> = {
  Agency: 'Imobiliária',
  Property: 'Imóvel',
  PropertyType: 'Tipo de Imóvel',
  User: 'Usuário',
  Document: 'Documento',
  Owner: 'Proprietário',
  Tenant: 'Inquilino',
  Lease: 'Locação',
  FinancialInstitution: 'Instituição Financeira',
  Category: 'Categoria',
  Subcategory: 'Subcategoria',
  Card: 'Cartão',
  Center: 'Centro',
  Supplier: 'Fornecedor',
  Transaction: 'Lançamento',
  Invoice: 'Fatura',
  RecurringConfig: 'Recorrência',
  Planning: 'Planejamento',
  UserGroup: 'Grupo de Usuário',
  Auth: 'Login',
};

export function modelLabel(tableName: string): string {
  return MODEL_LABELS[tableName] ?? tableName;
}

/**
 * "is_active" → "Is Active". Fallback quando o campo não está em
 * {@link FIELD_LABELS_PT}: rótulo aproximado, não tradução lapidada.
 */
export function prettifyFieldName(field: string): string {
  return field
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Rótulo PT-BR por nome técnico do campo. Todos os campos do sistema
 * traduzidos para exibição em auditoria.
 */
export const FIELD_LABELS_PT: Record<string, string> = {
  // Identificação e Cadastro
  legal_name: 'Razão Social',
  trade_name: 'Nome Fantasia',
  name: 'Nome',
  title: 'Título',
  description: 'Descrição',
  email: 'E-mail',
  phone: 'Telefone',
  cellphone: 'Celular',
  cpf: 'CPF',
  cnpj: 'CNPJ',
  rg: 'RG',
  rg_issuing_body: 'Órgão Emissor',
  rg_issuing_state: 'UF Emissor',
  nationality: 'Nacionalidade',
  marital_status: 'Estado Civil',
  occupation: 'Profissão',
  gender: 'Gênero',
  birth_date: 'Data de Nascimento',
  internal_code: 'Código Interno',
  sequential_id: 'Código',
  license_number: 'CRECI / Registro',
  state_registration: 'Inscrição Estadual',
  municipal_registration: 'Inscrição Municipal',
  tax_registration: 'Inscrição Imobiliária (IPTU)',
  registration_number: 'Matrícula',

  // Contato / Usuário / Permissões
  phone_country_code: 'DDI',
  phone_area_code: 'DDD',
  phone_extension: 'Ramal',
  contact: 'Nome do Contato',
  photo_url: 'Foto',
  role: 'Perfil de Acesso',
  has_time_restriction: 'Restrição de Horário',
  day_of_week: 'Dia da Semana',
  start_time: 'Horário de Início',
  end_time: 'Horário de Fim',
  resource: 'Recurso / Módulo',
  can_view: 'Pode Visualizar',
  can_create: 'Pode Criar',
  can_edit: 'Pode Editar',
  can_delete: 'Pode Excluir',
  can_export: 'Pode Exportar',
  can_custom_field: 'Diretivas de Campo',

  // Características do Imóvel
  bedrooms: 'Quartos',
  bathrooms: 'Banheiros',
  half_bathrooms: 'Lavabos',
  garage_spaces: 'Vagas de Garagem',
  area_total: 'Área Total (m²)',
  area_built: 'Área Construída (m²)',
  frontage: 'Frente (m)',
  furnished: 'Mobiliado',
  floor_number: 'Andar',
  notes: 'Observações',

  // Locação e Contrato
  contract_number: 'Número do Contrato',
  start_date: 'Data de Início',
  end_date: 'Data de Fim',
  rent_due_day: 'Vencimento do Aluguel (Dia)',
  tax_due_day: 'Vencimento do IPTU (Dia)',
  condo_due_day: 'Vencimento do Condomínio (Dia)',
  canceled_at: 'Data de Cancelamento',
  cancellation_justification: 'Justificativa de Cancelamento',
  cancellation_penalty: 'Multa de Cancelamento',
  other_cancellation_amounts: 'Outros Valores de Cancelamento',
  payment_condition: 'Condição de Pagamento',
  insurance_company: 'Seguradora',
  insurance_type: 'Tipo de Seguro',
  insurance_policy: 'Apólice de Seguro',
  guarantors: 'Garantias / Fiadores',

  // Datas, Meses e Anos
  month: 'Mês',
  year: 'Ano',
  event_date: 'Data do Evento',
  effective_date: 'Data Efetiva',
  due_date: 'Vencimento',
  purchase_date: 'Data da Compra',
  sale_date: 'Data da Venda',
  payment_date: 'Data do Pagamento',
  paid_date: 'Data do Pagamento',
  closing_date: 'Data de Fechamento',
  next_generation_date: 'Próxima Geração',

  // IPTU
  iptu_year: 'Ano do IPTU',
  iptu_installments: 'Parcelas do IPTU',
  iptu_installments_due_dates: 'Vencimentos do IPTU',
  iptu_installments_count: 'Qtd. de Parcelas do IPTU',
  property_tax_cash: 'IPTU à Vista',
  property_tax_cash_due_date: 'Vencimento IPTU à Vista',
  property_tax_first_installment: 'IPTU 1ª Parcela',
  property_tax_first_installment_due_date: 'Vencimento IPTU 1ª Parcela',
  property_tax_second_installment: 'IPTU 2ª Parcela',
  property_tax_second_installment_due_date: 'Vencimento IPTU 2ª Parcela',

  // Financeiro e Valores
  amount: 'Valor',
  default_amount: 'Valor Padrão',
  rent_amount: 'Valor do Aluguel',
  rental_value: 'Valor de Locação',
  sale_value: 'Valor de Venda',
  purchase_value: 'Valor de Compra',
  market_value: 'Valor de Mercado',
  total_amount: 'Valor Total',
  paid_amount: 'Valor Pago',
  commission_amount: 'Valor da Comissão',
  commission_percentage: 'Percentual de Comissão',
  agency_commission: 'Comissão da Imobiliária',
  extra_charges: 'Encargos Extras',
  condo_fee: 'Condomínio',
  property_tax: 'IPTU',
  current_balance: 'Saldo Atual',
  limit: 'Limite',
  max_recommended: 'Máximo Recomendado',
  min_recommended: 'Mínimo Recomendado',
  installment_number: 'Nº da Parcela',
  occurrence_number: 'Nº da Ocorrência',
  total_installments: 'Total de Parcelas',
  total_occurrences: 'Total de Ocorrências',
  generated_occurrences: 'Ocorrências Geradas',
  payment_mode: 'Forma de Pagamento',
  recurring_frequency: 'Frequência',
  frequency: 'Frequência',
  monthly_values: 'Valores Mensais',
  closing_day: 'Dia de Fechamento',
  due_day: 'Dia de Vencimento',
  brand: 'Bandeira',
  account_number: 'Número da Conta',
  agency_number: 'Número da Agência',
  bank_number: 'Código do Banco',
  dfc_group: 'Grupo DFC',

  // Status / Flags
  type: 'Tipo',
  status: 'Status',
  is_active: 'Ativo',
  is_featured: 'Destaque',
  is_transfer: 'É Transferência',
  is_recurring: 'É Recorrente',
  is_cancellation_charge: 'Encargo de Cancelamento',
  is_system: 'Do Sistema',
  created_via: 'Origem do Cadastro',

  // Arquivos
  file_path: 'Arquivo',
  file_type: 'Tipo de Arquivo',
  file_name: 'Nome do Arquivo',

  // Endereço
  address: 'Endereço',
  street: 'Logradouro / Rua',
  number: 'Número',
  complement: 'Complemento',
  district: 'Bairro',
  city: 'Cidade',
  state: 'Estado (UF)',
  country: 'País',
  zip_code: 'CEP',
  block: 'Quadra',
  lot: 'Lote',
  latitude: 'Latitude',
  longitude: 'Longitude',

  // Branding / Empresa
  app_title: 'Título do Sistema',
  app_description: 'Descrição do Sistema',
  company_name: 'Nome da Empresa',
  slug: 'Identificador (Slug)',
  db_quota_mb: 'Limite de Armazenamento (MB)',
  logo_url: 'Logo',
  favicon_url: 'Favicon',
  primary_color: 'Cor Primária',
  secondary_color: 'Cor Secundária',
  accent_color: 'Cor de Destaque',
  success_color: 'Cor de Sucesso',
  warning_color: 'Cor de Aviso',
  error_color: 'Cor de Erro',
  info_color: 'Cor Informativa',
  bg_color: 'Cor de Fundo',
  card_color: 'Cor dos Cards',
  border_color: 'Cor das Bordas',
  text_color: 'Cor do Texto',

  // Referências com nomes amigáveis
  category_id: 'Categoria',
  subcategory_id: 'Subcategoria',
  financial_institution_id: 'Instituição Financeira',
  card_id: 'Cartão',
  center_id: 'Centro de Custo / Lucro',
  supplier_id: 'Contato / Fornecedor',
  lease_id: 'Locação',
  property_id: 'Imóvel',
  property_type_id: 'Tipo de Imóvel',
  type_id: 'Tipo de Imóvel',
  agency_id: 'Imobiliária',
  owner_id: 'Proprietário',
  tenant_id: 'Inquilino',
  user_id: 'Usuário',
  user_group_id: 'Grupo de Usuário',
  invoice_id: 'Fatura',
  transaction_id: 'Lançamento',
};

/**
 * Campos técnicos internos que NUNCA devem aparecer no detalhe do log de auditoria:
 * IDs primários, chaves estrangeiras não amigáveis e timestamps de controle.
 */
export const AUDIT_HIDDEN_FIELDS = new Set<string>([
  'id',
  'company_id',
  'commission_category_id',
  'commission_subcategory_id',
  'income_category_id',
  'income_subcategory_id',
  'expense_category_id',
  'expense_subcategory_id',
  'iptu_refund_category_id',
  'iptu_refund_subcategory_id',
  'debit_center_id',
  'institution_id',
  'created_by',
  'updated_by',
  'deleted_by',
  'created_at',
  'updated_at',
  'deleted_at',
  'password',
  'recurring_group_id',
  'installment_group_id',
  'transfer_group_id',
  'parent_transaction_id',
  'address_id',
  'planning_id',
  'company_info',
]);

/**
 * Campos monetários (Decimal no schema) — exibidos com máscara de moeda.
 */
export const AUDIT_MONEY_FIELDS = new Set<string>([
  'amount',
  'default_amount',
  'rent_amount',
  'rental_value',
  'sale_value',
  'purchase_value',
  'market_value',
  'total_amount',
  'paid_amount',
  'commission_amount',
  'cancellation_penalty',
  'other_cancellation_amounts',
  'extra_charges',
  'condo_fee',
  'property_tax',
  'property_tax_cash',
  'property_tax_first_installment',
  'property_tax_second_installment',
  'current_balance',
  'limit',
  'max_recommended',
  'min_recommended',
]);

/** Campos percentuais — máscara `0,00 %`. */
export const AUDIT_PERCENT_FIELDS = new Set<string>([
  'commission_percentage',
  'agency_commission',
]);

export function fieldLabel(field: string): string {
  return FIELD_LABELS_PT[field] ?? prettifyFieldName(field);
}

/**
 * Sequência dos campos de negócio no detalhe do log.
 */
export const AUDIT_FIELD_ORDER: string[] = [
  'event_date',
  'effective_date',
  'category_id',
  'subcategory_id',
  'financial_institution_id',
  'card_id',
  'center_id',
  'supplier_id',
  'description',
  'amount',
  'status',
];

/**
 * Campos internos de controle (caso algum não esteja em AUDIT_HIDDEN_FIELDS).
 */
export const AUDIT_CONTROL_FIELDS = new Set<string>([
  'installment_number',
  'occurrence_number',
  'total_installments',
  'is_transfer',
  'is_recurring',
  'is_cancellation_charge',
  'payment_mode',
  'recurring_frequency',
]);

/**
 * Ordena os campos do diff: primeiro a sequência de Lançamentos, depois os
 * demais campos de negócio (alfabético) e, por último, os de controle.
 */
export function sortAuditFields<T extends { field: string }>(fields: T[]): T[] {
  const rank = (field: string): number => {
    const index = AUDIT_FIELD_ORDER.indexOf(field);
    if (index !== -1) return index;
    return AUDIT_CONTROL_FIELDS.has(field) ? 2000 : 1000;
  };

  return [...fields].sort((a, b) => {
    const diff = rank(a.field) - rank(b.field);
    if (diff !== 0) return diff;
    return fieldLabel(a.field).localeCompare(fieldLabel(b.field), 'pt-BR');
  });
}

/**
 * Normaliza o IP gravado no log (Tarefa 8.2). Node entrega IPv4 embrulhado em
 * IPv6 (`::ffff:172.22.0.11`) atrás de proxy/Docker — o usuário só reconhece a
 * parte IPv4. IPv6 de verdade é devolvido como está, sinalizado por `isIPv6`
 * para a coluna deixar isso claro.
 */
export function formatAuditIp(ip: string | null | undefined): { value: string; isIPv6: boolean } | null {
  if (!ip) return null;

  const raw = ip.trim();
  if (!raw) return null;

  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(raw);
  if (mapped) return { value: mapped[1], isIPv6: false };

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(raw)) return { value: raw, isIPv6: false };

  // Loopback IPv6 — o equivalente prático de "acesso local".
  if (raw === '::1') return { value: 'IPv6 ::1 (local)', isIPv6: true };

  // O cabeçalho da coluna é fixo, então a marcação de IPv6 vai no próprio
  // valor — é o que deixa claro ao usuário que aquilo não é um IPv4.
  if (raw.includes(':')) return { value: `IPv6 ${raw}`, isIPv6: true };

  return { value: raw, isIPv6: false };
}
