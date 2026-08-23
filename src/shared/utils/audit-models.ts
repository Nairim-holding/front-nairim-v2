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
 * Rótulo PT-BR por nome técnico do campo (Tarefa 8.2). "Fornecedor" virou
 * "Contato" para acompanhar o rótulo já usado na tela de Lançamentos.
 */
export const FIELD_LABELS_PT: Record<string, string> = {
  id: 'ID',
  company_id: 'Empresa',
  created_at: 'Criado em',
  created_by: 'Criado por',
  updated_at: 'Atualizado em',
  updated_by: 'Atualizado por',
  deleted_at: 'Excluído em',
  deleted_by: 'Excluído por',
  type: 'Tipo',
  status: 'Status',
  description: 'Descrição',
  amount: 'Valor',
  event_date: 'Data do Evento',
  effective_date: 'Data Efetiva',
  due_date: 'Vencimento',
  start_date: 'Data de Início',
  end_date: 'Data de Fim',
  is_active: 'Ativo',
  is_featured: 'Destaque',
  is_transfer: 'É Transferência',
  is_recurring: 'É Recorrente',
  is_cancellation_charge: 'Encargo de Cancelamento',
  name: 'Nome',
  title: 'Título',
  email: 'E-mail',
  phone: 'Telefone',
  cpf: 'CPF',
  cnpj: 'CNPJ',
  category_id: 'Categoria',
  subcategory_id: 'Subcategoria',
  financial_institution_id: 'Instituição Financeira',
  card_id: 'Cartão',
  center_id: 'Centro',
  supplier_id: 'Contato',
  lease_id: 'Locação',
  property_id: 'Imóvel',
  property_type_id: 'Tipo de Imóvel',
  agency_id: 'Imobiliária',
  owner_id: 'Proprietário',
  tenant_id: 'Inquilino',
  user_id: 'Usuário',
  invoice_id: 'Fatura',
  transaction_id: 'Lançamento',
  parent_transaction_id: 'Lançamento de Origem',
  recurring_group_id: 'Série de Recorrência',
  installment_group_id: 'Série de Parcelas',
  transfer_group_id: 'Par de Transferência',
  installment_number: 'Nº da Parcela',
  occurrence_number: 'Nº da Ocorrência',
  total_installments: 'Total de Parcelas',
  payment_mode: 'Forma de Pagamento',
  recurring_frequency: 'Frequência',
  file_path: 'Arquivo',
  file_type: 'Tipo de Arquivo',
  file_name: 'Nome do Arquivo',
  contract_number: 'Número do Contrato',
  address: 'Endereço',
  city: 'Cidade',
  state: 'Estado',
  zip_code: 'CEP',
  latitude: 'Latitude',
  longitude: 'Longitude',
  default_amount: 'Valor Padrão',
  monthly_values: 'Valores Mensais',
  purchase_date: 'Data da Compra',
  sale_date: 'Data da Venda',
  payment_date: 'Data do Pagamento',
  closing_date: 'Data de Fechamento',
  birth_date: 'Data de Nascimento',
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
  cancellation_penalty: 'Multa de Cancelamento',
  other_cancellation_amounts: 'Outros Valores de Cancelamento',
  extra_charges: 'Encargos Extras',
  condo_fee: 'Condomínio',
  property_tax: 'IPTU',
  property_tax_cash: 'IPTU à Vista',
  property_tax_first_installment: 'IPTU 1ª Parcela',
  property_tax_second_installment: 'IPTU 2ª Parcela',
  current_balance: 'Saldo Atual',
  limit: 'Limite',
  max_recommended: 'Máximo Recomendado',
  min_recommended: 'Mínimo Recomendado',
};

/**
 * Campos que nunca viram linha no detalhe do log: o uuid do proprio registro
 * nao diz nada ao usuario (a tela ja identifica qual registro esta sendo
 * auditado) e so ocupa espaco no diff.
 */
export const AUDIT_HIDDEN_FIELDS = new Set<string>(['id']);

/**
 * Campos monetarios (Decimal no schema) — exibidos com mascara de moeda.
 * `commission_percentage`/`agency_commission` sao Decimal(5,2) de PERCENTUAL,
 * por isso ficam de fora e entram em AUDIT_PERCENT_FIELDS.
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

/** Campos percentuais — mascara `0,00 %`. */
export const AUDIT_PERCENT_FIELDS = new Set<string>([
  'commission_percentage',
  'agency_commission',
]);

export function fieldLabel(field: string): string {
  return FIELD_LABELS_PT[field] ?? prettifyFieldName(field);
}

/**
 * Sequência dos campos de negócio no detalhe do log — a mesma da tela de
 * Lançamentos, para o usuário reconhecer a ordem (Tarefa 8.2).
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
 * Campos internos de controle: nunca vêm antes dos de negócio e só aparecem
 * quando têm algum valor (Tarefa 8.2).
 */
export const AUDIT_CONTROL_FIELDS = new Set<string>([
  'id',
  'company_id',
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
  'deleted_at',
  'deleted_by',
  'invoice_id',
  'lease_id',
  'parent_transaction_id',
  'recurring_group_id',
  'installment_group_id',
  'transfer_group_id',
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
